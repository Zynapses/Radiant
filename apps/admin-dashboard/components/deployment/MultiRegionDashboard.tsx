'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Globe,
  Activity,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Play,
  RotateCcw,
  Clock,
  MapPin,
} from 'lucide-react';

interface RegionConfig {
  id: string;
  region: string;
  displayName: string;
  isPrimary: boolean;
  isEnabled: boolean;
  endpoint: string;
  healthStatus: 'healthy' | 'unhealthy' | 'unknown' | 'deploying';
  lastDeployedVersion: string | null;
  lastDeployedAt: string | null;
  latencyMs: number | null;
}

interface MultiRegionDeployment {
  id: string;
  packageVersion: string;
  strategy: 'sequential' | 'parallel' | 'canary' | 'blue_green';
  targetRegions: string[];
  startedAt: string;
  completedAt: string | null;
  regionStatuses: Record<string, RegionDeploymentStatus>;
}

interface RegionDeploymentStatus {
  region: string;
  status: 'pending' | 'deploying' | 'verifying' | 'completed' | 'failed' | 'rolled_back';
  progress: number;
  message: string | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

interface ConsistencyCheck {
  isConsistent: boolean;
  primaryVersion: string | null;
  regionVersions: Record<string, string>;
  driftDetected: string[];
  recommendations: string[];
}

const REGION_DISPLAY_NAMES: Record<string, string> = {
  'us-east-1': 'US East (N. Virginia)',
  'us-west-2': 'US West (Oregon)',
  'eu-west-1': 'EU (Ireland)',
  'eu-central-1': 'EU (Frankfurt)',
  'ap-southeast-1': 'Asia Pacific (Singapore)',
  'ap-northeast-1': 'Asia Pacific (Tokyo)',
};

const statusColors: Record<string, string> = {
  healthy: 'text-green-500',
  unhealthy: 'text-red-500',
  unknown: 'text-gray-500',
  deploying: 'text-blue-500',
  pending: 'text-gray-500',
  verifying: 'text-yellow-500',
  completed: 'text-green-500',
  failed: 'text-red-500',
  rolled_back: 'text-orange-500',
};

const statusIcons: Record<string, typeof CheckCircle> = {
  healthy: CheckCircle,
  unhealthy: XCircle,
  unknown: AlertTriangle,
  deploying: RefreshCw,
  pending: Clock,
  verifying: Activity,
  completed: CheckCircle,
  failed: XCircle,
  rolled_back: RotateCcw,
};

export function MultiRegionDashboard() {
  const queryClient = useQueryClient();
  const [selectedStrategy, setSelectedStrategy] = useState<string>('canary');

  const { data: regions, isLoading: regionsLoading } = useQuery<RegionConfig[]>({
    queryKey: ['multi-region-configs'],
    queryFn: () => fetch('/api/admin/multi-region/regions').then((r) => r.json()),
  });

  const { data: consistency } = useQuery<ConsistencyCheck>({
    queryKey: ['multi-region-consistency'],
    queryFn: () => fetch('/api/admin/multi-region/consistency').then((r) => r.json()),
    refetchInterval: 30000,
  });

  const { data: currentDeployment } = useQuery<MultiRegionDeployment | null>({
    queryKey: ['multi-region-deployment'],
    queryFn: () => fetch('/api/admin/multi-region/deployment/current').then((r) => r.json()),
    refetchInterval: 5000,
  });

  const deployMutation = useMutation({
    mutationFn: (params: { version: string; regions: string[]; strategy: string }) =>
      fetch('/api/admin/multi-region/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['multi-region-deployment'] }),
  });

  const enabledRegions = regions?.filter((r) => r.isEnabled) || [];
  const primaryRegion = regions?.find((r) => r.isPrimary);
  const healthyCount = enabledRegions.filter((r) => r.healthStatus === 'healthy').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Globe className="h-6 w-6" />
            Multi-Region Deployment
          </h2>
          <p className="text-muted-foreground">
            Manage deployments across multiple AWS regions
          </p>
        </div>
        <Button
          onClick={() => queryClient.invalidateQueries({ queryKey: ['multi-region-configs'] })}
          variant="outline"
          size="icon"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Consistency Alert */}
      {consistency && !consistency.isConsistent && (
        <div className="bg-orange-500/10 border border-orange-500 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <div>
              <h3 className="font-semibold text-orange-500">Version Drift Detected</h3>
              <p className="text-sm text-muted-foreground">
                Regions have inconsistent versions: {consistency.driftDetected.join(', ')}
              </p>
            </div>
            <Button variant="outline" className="ml-auto" size="sm">
              Sync All Regions
            </Button>
          </div>
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Regions</CardDescription>
            <CardTitle className="text-3xl">{regions?.length || 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Globe className="h-4 w-4" />
              <span>{enabledRegions.length} enabled</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Healthy</CardDescription>
            <CardTitle className="text-3xl text-green-500">
              {healthyCount}/{enabledRegions.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Regions healthy</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Primary Region</CardDescription>
            <CardTitle className="text-lg">
              {primaryRegion ? REGION_DISPLAY_NAMES[primaryRegion.region] || primaryRegion.region : 'Not Set'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{primaryRegion?.region || '-'}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Consistency</CardDescription>
            <CardTitle className={`text-lg ${consistency?.isConsistent ? 'text-green-500' : 'text-orange-500'}`}>
              {consistency?.isConsistent ? 'Consistent' : 'Drift Detected'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Activity className="h-4 w-4" />
              <span>{consistency?.driftDetected.length || 0} drifted</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Current Deployment Progress */}
      {currentDeployment && !currentDeployment.completedAt && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 animate-spin" />
              Deployment In Progress
            </CardTitle>
            <CardDescription>
              Deploying {currentDeployment.packageVersion} using {currentDeployment.strategy} strategy
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(currentDeployment.regionStatuses).map(([region, status]) => {
                const StatusIcon = statusIcons[status.status] || Clock;
                return (
                  <div key={region} className="flex items-center gap-4">
                    <StatusIcon className={`h-5 w-5 ${statusColors[status.status]}`} />
                    <div className="flex-1">
                      <div className="flex justify-between mb-1">
                        <span className="font-medium">
                          {REGION_DISPLAY_NAMES[region] || region}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {status.message || status.status}
                        </span>
                      </div>
                      <Progress value={status.progress * 100} className="h-2" />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Regions List */}
      <Tabs defaultValue="regions">
        <TabsList>
          <TabsTrigger value="regions">Regions</TabsTrigger>
          <TabsTrigger value="deploy">Deploy</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="regions" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Configured Regions</CardTitle>
              <CardDescription>All configured deployment regions</CardDescription>
            </CardHeader>
            <CardContent>
              {regionsLoading ? (
                <div className="flex justify-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-3">
                  {regions?.map((region) => {
                    const StatusIcon = statusIcons[region.healthStatus] || AlertTriangle;
                    return (
                      <div
                        key={region.id}
                        className="flex items-center gap-4 p-4 border rounded-lg"
                      >
                        <StatusIcon className={`h-6 w-6 ${statusColors[region.healthStatus]}`} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {REGION_DISPLAY_NAMES[region.region] || region.region}
                            </span>
                            {region.isPrimary && (
                              <Badge variant="default">Primary</Badge>
                            )}
                            {!region.isEnabled && (
                              <Badge variant="secondary">Disabled</Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {region.lastDeployedVersion
                              ? `v${region.lastDeployedVersion}`
                              : 'Not deployed'}{' '}
                            • {region.latencyMs ? `${region.latencyMs}ms` : '-'}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">
                            Health Check
                          </Button>
                          <Button variant="outline" size="sm">
                            Configure
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deploy" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Deploy to Multiple Regions</CardTitle>
              <CardDescription>Start a multi-region deployment</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Deployment Strategy
                  </label>
                  <Select value={selectedStrategy} onValueChange={setSelectedStrategy}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="canary">
                        Canary - Deploy to primary first, then others
                      </SelectItem>
                      <SelectItem value="sequential">
                        Sequential - One region at a time
                      </SelectItem>
                      <SelectItem value="parallel">
                        Parallel - All regions simultaneously
                      </SelectItem>
                      <SelectItem value="blue_green">
                        Blue/Green - Deploy all, then switch traffic
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Target Regions
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {enabledRegions.map((region) => (
                      <div
                        key={region.id}
                        className="flex items-center gap-2 p-2 border rounded"
                      >
                        <input type="checkbox" defaultChecked className="rounded" />
                        <span>{REGION_DISPLAY_NAMES[region.region] || region.region}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Button
                  className="w-full"
                  disabled={deployMutation.isPending || Boolean(currentDeployment && !currentDeployment.completedAt)}
                >
                  <Play className="h-4 w-4 mr-2" />
                  {deployMutation.isPending ? 'Starting...' : 'Start Multi-Region Deployment'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Deployment History</CardTitle>
              <CardDescription>Recent multi-region deployments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-2" />
                <p>Deployment history will appear here</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
