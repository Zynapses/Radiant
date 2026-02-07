'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { 
  Camera,
  RefreshCw,
  Trash2,
  Download,
  Clock,
  Database,
  HardDrive,
  Archive,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  History,
  Settings,
  Play,
  ArrowRight
} from 'lucide-react';

// Snapshot types matching Swift implementation
type SnapshotType = 'full' | 'aurora_only' | 'dynamodb_only' | 'schema_only' | 'incremental';
type SnapshotStatus = 'creating' | 'available' | 'restoring' | 'deleting' | 'failed' | 'transitioning';
type StorageTier = 'hot' | 'warm' | 'cold' | 'archive';

interface Snapshot {
  id: string;
  version: string;
  name: string;
  description?: string;
  createdAt: string;
  createdBy: string;
  environment: string;
  appId: string;
  snapshotType: SnapshotType;
  status: SnapshotStatus;
  storageTier: StorageTier;
  tierTransitionDate?: string;
  auroraSnapshotArn?: string;
  dynamoDBBackupArns: string[];
  s3ManifestKey?: string;
  sizeBytes: number;
  tableCount: number;
  resourceCount: number;
  tags: Record<string, string>;
  lastRestoredAt?: string;
  restoreCount: number;
}

interface SnapshotPolicy {
  autoSnapshotEnabled: boolean;
  autoSnapshotSchedule: string;
  retentionDays: number;
  tierTransitionRules: {
    fromTier: StorageTier;
    toTier: StorageTier;
    afterDays: number;
  }[];
  maxSnapshotsPerTier: number;
  preDeploymentSnapshotEnabled: boolean;
  preSchemaMigrationSnapshotEnabled: boolean;
}

// Mock data for demonstration
const mockSnapshots: Snapshot[] = [
  {
    id: 'radiant-prod-20260205-021500',
    version: '20260205-021500',
    name: 'Pre-deployment backup',
    description: 'Automatic snapshot before v4.18.0 deployment',
    createdAt: '2026-02-05T02:15:00Z',
    createdBy: 'system',
    environment: 'production',
    appId: 'radiant',
    snapshotType: 'full',
    status: 'available',
    storageTier: 'hot',
    auroraSnapshotArn: 'arn:aws:rds:us-east-1:123456789:cluster-snapshot:radiant-prod-20260205',
    dynamoDBBackupArns: ['arn:aws:dynamodb:us-east-1:123456789:table/sessions/backup/001'],
    sizeBytes: 5368709120, // 5 GB
    tableCount: 44,
    resourceCount: 12,
    tags: { 'radiant:snapshot': 'true' },
    restoreCount: 0,
  },
  {
    id: 'radiant-prod-20260204-020000',
    version: '20260204-020000',
    name: 'Daily backup',
    createdAt: '2026-02-04T02:00:00Z',
    createdBy: 'scheduled',
    environment: 'production',
    appId: 'radiant',
    snapshotType: 'full',
    status: 'available',
    storageTier: 'warm',
    tierTransitionDate: '2026-02-11T02:00:00Z',
    auroraSnapshotArn: 'arn:aws:rds:us-east-1:123456789:cluster-snapshot:radiant-prod-20260204',
    dynamoDBBackupArns: [],
    sizeBytes: 5200000000,
    tableCount: 44,
    resourceCount: 10,
    tags: {},
    restoreCount: 1,
    lastRestoredAt: '2026-02-04T15:30:00Z',
  },
  {
    id: 'radiant-prod-20260128-020000',
    version: '20260128-020000',
    name: 'Weekly backup',
    createdAt: '2026-01-28T02:00:00Z',
    createdBy: 'scheduled',
    environment: 'production',
    appId: 'radiant',
    snapshotType: 'full',
    status: 'available',
    storageTier: 'cold',
    tierTransitionDate: '2026-02-04T02:00:00Z',
    auroraSnapshotArn: 'arn:aws:rds:us-east-1:123456789:cluster-snapshot:radiant-prod-20260128',
    dynamoDBBackupArns: [],
    sizeBytes: 4800000000,
    tableCount: 42,
    resourceCount: 10,
    tags: {},
    restoreCount: 0,
  },
];

const defaultPolicy: SnapshotPolicy = {
  autoSnapshotEnabled: true,
  autoSnapshotSchedule: '0 2 * * *',
  retentionDays: 365,
  tierTransitionRules: [
    { fromTier: 'hot', toTier: 'warm', afterDays: 7 },
    { fromTier: 'warm', toTier: 'cold', afterDays: 30 },
    { fromTier: 'cold', toTier: 'archive', afterDays: 365 },
  ],
  maxSnapshotsPerTier: 10,
  preDeploymentSnapshotEnabled: true,
  preSchemaMigrationSnapshotEnabled: true,
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString();
}

function getStatusColor(status: SnapshotStatus): string {
  switch (status) {
    case 'available': return 'bg-green-500';
    case 'creating':
    case 'restoring':
    case 'transitioning': return 'bg-yellow-500';
    case 'deleting':
    case 'failed': return 'bg-red-500';
    default: return 'bg-gray-500';
  }
}

function getTierColor(tier: StorageTier): string {
  switch (tier) {
    case 'hot': return 'text-red-500 bg-red-50';
    case 'warm': return 'text-orange-500 bg-orange-50';
    case 'cold': return 'text-blue-500 bg-blue-50';
    case 'archive': return 'text-purple-500 bg-purple-50';
    default: return 'text-gray-500 bg-gray-50';
  }
}

function getTierIcon(tier: StorageTier) {
  switch (tier) {
    case 'hot': return <HardDrive className="h-4 w-4" />;
    case 'warm': return <Database className="h-4 w-4" />;
    case 'cold': return <Archive className="h-4 w-4" />;
    case 'archive': return <Archive className="h-4 w-4" />;
  }
}

function getRestoreTime(tier: StorageTier): string {
  switch (tier) {
    case 'hot': return 'Instant';
    case 'warm': return '3-5 minutes';
    case 'cold': return '1-5 hours';
    case 'archive': return '12-48 hours';
  }
}

// Tier rule and cost types for state
interface TierRule {
  id: string;
  fromTier: StorageTier;
  toTier: StorageTier;
  afterDays: number;
  isEnabled: boolean;
}

interface TierCost {
  id: string;
  tier: StorageTier;
  costPerGbMonth: number;
  retrievalCostPerGb: number;
  retrievalTimeHours: number;
}

// Default tier rules
const defaultTierRules: TierRule[] = [
  { id: '1', fromTier: 'hot', toTier: 'warm', afterDays: 7, isEnabled: true },
  { id: '2', fromTier: 'warm', toTier: 'cold', afterDays: 30, isEnabled: true },
  { id: '3', fromTier: 'cold', toTier: 'archive', afterDays: 365, isEnabled: true },
];

// Default tier costs (AWS pricing estimates)
const defaultTierCosts: TierCost[] = [
  { id: '1', tier: 'hot', costPerGbMonth: 0.023, retrievalCostPerGb: 0, retrievalTimeHours: 0 },
  { id: '2', tier: 'warm', costPerGbMonth: 0.0125, retrievalCostPerGb: 0.01, retrievalTimeHours: 0.083 },
  { id: '3', tier: 'cold', costPerGbMonth: 0.004, retrievalCostPerGb: 0.02, retrievalTimeHours: 5 },
  { id: '4', tier: 'archive', costPerGbMonth: 0.00099, retrievalCostPerGb: 0.03, retrievalTimeHours: 12 },
];

export default function SnapshotManagementPage() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>(mockSnapshots);
  const [selectedSnapshot, setSelectedSnapshot] = useState<Snapshot | null>(null);
  const [policy, setPolicy] = useState<SnapshotPolicy>(defaultPolicy);
  const [tierRules, setTierRules] = useState<TierRule[]>(defaultTierRules);
  const [tierCosts, setTierCosts] = useState<TierCost[]>(defaultTierCosts);
  const [isCreating, setIsCreating] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [createProgress, setCreateProgress] = useState(0);
  const [filterTier, setFilterTier] = useState<StorageTier | 'all'>('all');

  // Tier summary
  const tierCounts = {
    hot: snapshots.filter(s => s.storageTier === 'hot').length,
    warm: snapshots.filter(s => s.storageTier === 'warm').length,
    cold: snapshots.filter(s => s.storageTier === 'cold').length,
    archive: snapshots.filter(s => s.storageTier === 'archive').length,
  };

  const totalSize = snapshots.reduce((sum, s) => sum + s.sizeBytes, 0);

  const filteredSnapshots = filterTier === 'all' 
    ? snapshots 
    : snapshots.filter(s => s.storageTier === filterTier);

  const handleCreateSnapshot = async () => {
    setIsCreating(true);
    setCreateProgress(0);
    
    // Simulate creation progress
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 500));
      setCreateProgress(i);
    }
    
    setIsCreating(false);
  };

  const handleRestore = async (snapshot: Snapshot) => {
    setIsRestoring(true);
    // Would call API to restore
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsRestoring(false);
  };

  const handleTransitionTier = async (snapshotId: string, targetTier: StorageTier) => {
    // Call API to transition tier
    try {
      await fetch(`/api/admin/snapshot-storage/snapshots/${snapshotId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetTier }),
      });
      setSnapshots(prev => prev.map(s => 
        s.id === snapshotId ? { ...s, storageTier: targetTier, tierTransitionDate: new Date().toISOString() } : s
      ));
    } catch (error) {
      console.error('Failed to transition tier:', error);
    }
  };

  // Save policy to backend (persistent)
  const handleSavePolicy = async (updates: Partial<SnapshotPolicy>) => {
    setIsSaving(true);
    try {
      await fetch('/api/admin/snapshot-storage/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
    } catch (error) {
      console.error('Failed to save policy:', error);
    }
    setIsSaving(false);
  };

  // Save tier rules to backend (persistent)
  const handleSaveTierRules = async (rules: TierRule[]) => {
    setIsSaving(true);
    try {
      await fetch('/api/admin/snapshot-storage/tier-rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules }),
      });
    } catch (error) {
      console.error('Failed to save tier rules:', error);
    }
    setIsSaving(false);
  };

  // Save tier costs to backend (persistent)
  const handleSaveTierCosts = async (costs: TierCost[]) => {
    setIsSaving(true);
    try {
      await fetch('/api/admin/snapshot-storage/tier-costs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ costs }),
      });
    } catch (error) {
      console.error('Failed to save tier costs:', error);
    }
    setIsSaving(false);
  };

  // Load data from backend on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch('/api/admin/snapshot-storage/dashboard');
        if (response.ok) {
          const data = await response.json();
          if (data.data?.config) {
            setPolicy({
              ...defaultPolicy,
              autoSnapshotEnabled: data.data.config.auto_snapshot_enabled ?? true,
              autoSnapshotSchedule: data.data.config.auto_snapshot_schedule ?? '0 2 * * *',
              retentionDays: data.data.config.retention_days ?? 365,
              maxSnapshotsPerTier: data.data.config.max_snapshots_per_tier ?? 10,
              preDeploymentSnapshotEnabled: data.data.config.pre_deployment_snapshot_enabled ?? true,
              preSchemaMigrationSnapshotEnabled: data.data.config.pre_migration_snapshot_enabled ?? true,
            });
          }
          if (data.data?.tierRules?.length) {
            setTierRules(data.data.tierRules.map((r: any) => ({
              id: r.id,
              fromTier: r.from_tier,
              toTier: r.to_tier,
              afterDays: r.after_days,
              isEnabled: r.is_enabled,
            })));
          }
          if (data.data?.tierCosts?.length) {
            setTierCosts(data.data.tierCosts.map((c: any) => ({
              id: c.id,
              tier: c.tier,
              costPerGbMonth: parseFloat(c.cost_per_gb_month) || 0,
              retrievalCostPerGb: parseFloat(c.retrieval_cost_per_gb) || 0,
              retrievalTimeHours: parseFloat(c.retrieval_time_hours) || 0,
            })));
          }
        }
      } catch (error) {
        console.error('Failed to load snapshot storage config:', error);
      }
    };
    loadData();
  }, []);

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Camera className="h-8 w-8 text-blue-500" />
            <h1 className="text-3xl font-bold">Snapshot Manager</h1>
            <Badge variant="outline" className="text-blue-500">v1.4.0</Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            Create, restore, and manage versioned snapshots with tiered storage lifecycle
          </p>
        </div>
        <Button onClick={handleCreateSnapshot} disabled={isCreating}>
          {isCreating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Camera className="mr-2 h-4 w-4" />
              Create Snapshot
            </>
          )}
        </Button>
      </div>

      {/* Creation Progress */}
      {isCreating && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Creating snapshot...</span>
                <span>{createProgress}%</span>
              </div>
              <Progress value={createProgress} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Snapshots</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{snapshots.length}</div>
            <p className="text-xs text-muted-foreground">{formatBytes(totalSize)} total</p>
          </CardContent>
        </Card>
        
        {(['hot', 'warm', 'cold', 'archive'] as StorageTier[]).map(tier => (
          <Card key={tier} className="cursor-pointer hover:bg-muted/50" onClick={() => setFilterTier(tier)}>
            <CardHeader className="pb-2">
              <CardTitle className={`text-sm font-medium flex items-center gap-2 ${getTierColor(tier).split(' ')[0]}`}>
                {getTierIcon(tier)}
                {tier.charAt(0).toUpperCase() + tier.slice(1)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tierCounts[tier]}</div>
              <p className="text-xs text-muted-foreground">Restore: {getRestoreTime(tier)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="snapshots" className="space-y-4">
        <TabsList>
          <TabsTrigger value="snapshots">
            <Database className="mr-2 h-4 w-4" />
            Snapshots
          </TabsTrigger>
          <TabsTrigger value="lifecycle">
            <ArrowRight className="mr-2 h-4 w-4" />
            Lifecycle Rules
          </TabsTrigger>
          <TabsTrigger value="policy">
            <Settings className="mr-2 h-4 w-4" />
            Policy
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="mr-2 h-4 w-4" />
            Restore History
          </TabsTrigger>
        </TabsList>

        {/* Snapshots Tab */}
        <TabsContent value="snapshots" className="space-y-4">
          {/* Filter */}
          <div className="flex items-center gap-4">
            <Label>Filter by tier:</Label>
            <Select value={filterTier} onValueChange={(v) => setFilterTier(v as StorageTier | 'all')}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="hot">Hot</SelectItem>
                <SelectItem value="warm">Warm</SelectItem>
                <SelectItem value="cold">Cold</SelectItem>
                <SelectItem value="archive">Archive</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">
              {filteredSnapshots.length} snapshot{filteredSnapshots.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Snapshot List */}
          <div className="space-y-3">
            {filteredSnapshots.map(snapshot => (
              <Card 
                key={snapshot.id} 
                className={`cursor-pointer transition-colors ${selectedSnapshot?.id === snapshot.id ? 'ring-2 ring-blue-500' : 'hover:bg-muted/50'}`}
                onClick={() => setSelectedSnapshot(snapshot)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(snapshot.status)}`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{snapshot.name}</span>
                          <Badge variant="outline">v{snapshot.version}</Badge>
                          <Badge className={getTierColor(snapshot.storageTier)}>
                            {snapshot.storageTier}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                          <span>{snapshot.environment}</span>
                          <span>{formatBytes(snapshot.sizeBytes)}</span>
                          <span>{snapshot.tableCount} tables</span>
                          <span>{formatDate(snapshot.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); handleRestore(snapshot); }}
                        disabled={isRestoring}
                      >
                        <RefreshCw className="mr-1 h-3 w-3" />
                        Restore
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Selected Snapshot Detail */}
          {selectedSnapshot && (
            <Card>
              <CardHeader>
                <CardTitle>Snapshot Details</CardTitle>
                <CardDescription>{selectedSnapshot.name}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">ID</Label>
                    <p className="font-mono text-sm">{selectedSnapshot.id}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Type</Label>
                    <p>{selectedSnapshot.snapshotType}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Environment</Label>
                    <p>{selectedSnapshot.appId} / {selectedSnapshot.environment}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Created By</Label>
                    <p>{selectedSnapshot.createdBy}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Size</Label>
                    <p>{formatBytes(selectedSnapshot.sizeBytes)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Tables</Label>
                    <p>{selectedSnapshot.tableCount}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Restore Count</Label>
                    <p>{selectedSnapshot.restoreCount}</p>
                  </div>
                  {selectedSnapshot.lastRestoredAt && (
                    <div>
                      <Label className="text-muted-foreground">Last Restored</Label>
                      <p>{formatDate(selectedSnapshot.lastRestoredAt)}</p>
                    </div>
                  )}
                </div>

                {/* Tier Transition */}
                <div className="border-t pt-4">
                  <Label>Move to Tier</Label>
                  <div className="flex gap-2 mt-2">
                    {(['hot', 'warm', 'cold', 'archive'] as StorageTier[])
                      .filter(t => t !== selectedSnapshot.storageTier)
                      .map(tier => (
                        <Button 
                          key={tier}
                          variant="outline" 
                          size="sm"
                          onClick={() => handleTransitionTier(selectedSnapshot.id, tier)}
                        >
                          {tier.charAt(0).toUpperCase() + tier.slice(1)}
                        </Button>
                      ))
                    }
                  </div>
                </div>

                {/* Resources */}
                <div className="border-t pt-4">
                  <Label>Resources</Label>
                  <div className="space-y-2 mt-2">
                    {selectedSnapshot.auroraSnapshotArn && (
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span>Aurora Cluster Snapshot</span>
                      </div>
                    )}
                    {selectedSnapshot.dynamoDBBackupArns.length > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span>{selectedSnapshot.dynamoDBBackupArns.length} DynamoDB Backups</span>
                      </div>
                    )}
                    {selectedSnapshot.s3ManifestKey && (
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span>S3 Manifest</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Lifecycle Rules Tab */}
        <TabsContent value="lifecycle" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tiered Storage Lifecycle</CardTitle>
              <CardDescription>
                Snapshots automatically transition between tiers to optimize cost
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between py-8">
                {(['hot', 'warm', 'cold', 'archive'] as StorageTier[]).map((tier, index) => (
                  <div key={tier} className="flex items-center">
                    <div className={`p-4 rounded-lg ${getTierColor(tier)} text-center`}>
                      {getTierIcon(tier)}
                      <div className="font-medium mt-2">{tier.charAt(0).toUpperCase() + tier.slice(1)}</div>
                      <div className="text-xs mt-1">
                        {tier === 'hot' && '0-7 days'}
                        {tier === 'warm' && '7-30 days'}
                        {tier === 'cold' && '30-365 days'}
                        {tier === 'archive' && '365+ days'}
                      </div>
                      <div className="text-xs mt-1 opacity-75">
                        {getRestoreTime(tier)}
                      </div>
                    </div>
                    {index < 3 && (
                      <ArrowRight className="mx-4 h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                {policy.tierTransitionRules.map((rule, index) => (
                  <div key={index} className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                    <Badge className={getTierColor(rule.fromTier)}>{rule.fromTier}</Badge>
                    <ArrowRight className="h-4 w-4" />
                    <Badge className={getTierColor(rule.toTier)}>{rule.toTier}</Badge>
                    <span className="text-sm text-muted-foreground">after {rule.afterDays} days</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Policy Tab */}
        <TabsContent value="policy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Snapshot Policy</CardTitle>
              <CardDescription>Configure automatic snapshot behavior - all changes are saved persistently</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto Snapshots</Label>
                  <p className="text-sm text-muted-foreground">Automatically create daily snapshots</p>
                </div>
                <Switch 
                  checked={policy.autoSnapshotEnabled} 
                  onCheckedChange={(checked) => {
                    setPolicy({ ...policy, autoSnapshotEnabled: checked });
                    handleSavePolicy({ autoSnapshotEnabled: checked });
                  }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Pre-Deployment Snapshots</Label>
                  <p className="text-sm text-muted-foreground">Create snapshot before each deployment</p>
                </div>
                <Switch 
                  checked={policy.preDeploymentSnapshotEnabled} 
                  onCheckedChange={(checked) => {
                    setPolicy({ ...policy, preDeploymentSnapshotEnabled: checked });
                    handleSavePolicy({ preDeploymentSnapshotEnabled: checked });
                  }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Pre-Migration Snapshots</Label>
                  <p className="text-sm text-muted-foreground">Create full RDS snapshot before destructive schema changes</p>
                </div>
                <Switch 
                  checked={policy.preSchemaMigrationSnapshotEnabled} 
                  onCheckedChange={(checked) => {
                    setPolicy({ ...policy, preSchemaMigrationSnapshotEnabled: checked });
                    handleSavePolicy({ preSchemaMigrationSnapshotEnabled: checked });
                  }}
                />
              </div>

              <div>
                <Label>Snapshot Type</Label>
                <Select 
                  value={policy.autoSnapshotSchedule.includes('full') ? 'full' : 'aurora_only'}
                  onValueChange={(value) => {
                    // This would update the snapshot type
                  }}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Full (Aurora + DynamoDB + S3)</SelectItem>
                    <SelectItem value="aurora_only">Aurora Only</SelectItem>
                    <SelectItem value="dynamodb_only">DynamoDB Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Schedule (Cron)</Label>
                <Input 
                  value={policy.autoSnapshotSchedule} 
                  onChange={(e) => setPolicy({ ...policy, autoSnapshotSchedule: e.target.value })}
                  onBlur={() => handleSavePolicy({ autoSnapshotSchedule: policy.autoSnapshotSchedule })}
                  className="mt-2 font-mono"
                  placeholder="0 2 * * *"
                />
                <p className="text-xs text-muted-foreground mt-1">Daily at 2:00 AM (cron format)</p>
              </div>

              <div>
                <Label>Retention Period</Label>
                <div className="flex items-center gap-2 mt-2">
                  <Input 
                    type="number" 
                    value={policy.retentionDays}
                    onChange={(e) => setPolicy({ ...policy, retentionDays: parseInt(e.target.value) || 365 })}
                    onBlur={() => handleSavePolicy({ retentionDays: policy.retentionDays })}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">days</span>
                </div>
              </div>

              <div>
                <Label>Max Snapshots per Tier</Label>
                <div className="flex items-center gap-2 mt-2">
                  <Input 
                    type="number" 
                    value={policy.maxSnapshotsPerTier}
                    onChange={(e) => setPolicy({ ...policy, maxSnapshotsPerTier: parseInt(e.target.value) || 10 })}
                    onBlur={() => handleSavePolicy({ maxSnapshotsPerTier: policy.maxSnapshotsPerTier })}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">snapshots</span>
                </div>
              </div>

              {isSaving && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tier Transition Rules - Editable */}
          <Card>
            <CardHeader>
              <CardTitle>Tier Transition Rules</CardTitle>
              <CardDescription>Configure when snapshots move between storage tiers</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {tierRules.map((rule, index) => (
                <div key={rule.id} className="flex items-center gap-4 p-4 border rounded-lg">
                  <Switch 
                    checked={rule.isEnabled}
                    onCheckedChange={(checked) => {
                      const newRules = [...tierRules];
                      newRules[index] = { ...rule, isEnabled: checked };
                      setTierRules(newRules);
                      handleSaveTierRules(newRules);
                    }}
                  />
                  <Badge className={getTierColor(rule.fromTier)}>{rule.fromTier}</Badge>
                  <ArrowRight className="h-4 w-4" />
                  <Badge className={getTierColor(rule.toTier)}>{rule.toTier}</Badge>
                  <span className="text-sm">after</span>
                  <Input 
                    type="number"
                    value={rule.afterDays}
                    onChange={(e) => {
                      const newRules = [...tierRules];
                      newRules[index] = { ...rule, afterDays: parseInt(e.target.value) || 7 };
                      setTierRules(newRules);
                    }}
                    onBlur={() => handleSaveTierRules(tierRules)}
                    className="w-20"
                  />
                  <span className="text-sm">days</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Tier Cost Estimates - Editable */}
          <Card>
            <CardHeader>
              <CardTitle>Storage Cost Estimates</CardTitle>
              <CardDescription>Configure cost per GB/month for billing estimates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {tierCosts.map((cost, index) => (
                  <div key={cost.id} className="grid grid-cols-4 gap-4 items-center p-4 border rounded-lg">
                    <div className="flex items-center gap-2">
                      {getTierIcon(cost.tier)}
                      <span className="font-medium capitalize">{cost.tier}</span>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">$/GB/month</Label>
                      <Input 
                        type="number"
                        step="0.001"
                        value={cost.costPerGbMonth}
                        onChange={(e) => {
                          const newCosts = [...tierCosts];
                          newCosts[index] = { ...cost, costPerGbMonth: parseFloat(e.target.value) || 0 };
                          setTierCosts(newCosts);
                        }}
                        onBlur={() => handleSaveTierCosts(tierCosts)}
                        className="w-24"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Retrieval $/GB</Label>
                      <Input 
                        type="number"
                        step="0.001"
                        value={cost.retrievalCostPerGb}
                        onChange={(e) => {
                          const newCosts = [...tierCosts];
                          newCosts[index] = { ...cost, retrievalCostPerGb: parseFloat(e.target.value) || 0 };
                          setTierCosts(newCosts);
                        }}
                        onBlur={() => handleSaveTierCosts(tierCosts)}
                        className="w-24"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Retrieval Hours</Label>
                      <Input 
                        type="number"
                        step="0.1"
                        value={cost.retrievalTimeHours}
                        onChange={(e) => {
                          const newCosts = [...tierCosts];
                          newCosts[index] = { ...cost, retrievalTimeHours: parseFloat(e.target.value) || 0 };
                          setTierCosts(newCosts);
                        }}
                        onBlur={() => handleSaveTierCosts(tierCosts)}
                        className="w-24"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Restore History</CardTitle>
              <CardDescription>Log of all snapshot restoration operations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <div className="flex-1">
                    <div className="font-medium">radiant-prod-20260204-020000</div>
                    <div className="text-sm text-muted-foreground">
                      Restored to production • Feb 4, 2026 3:30 PM
                    </div>
                  </div>
                  <Badge>Success</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
