'use client';

/**
 * RADIANT Neural Operations Center
 * Dashboard for monitoring CORTEX networks, shadow validations,
 * regional thermal state, and system health.
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Brain,
  Globe,
  Server,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Thermometer,
  Clock,
  Zap,
  Shield,
  Network,
  Bell,
  Settings,
  Cpu,
  BarChart3,
} from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

type CortexNetworkId = 'pattern' | 'routing' | 'topology' | 'clarion' | 'combination' | 'user';

interface CortexNetworkStatus {
  id: CortexNetworkId;
  name: string;
  version: string;
  status: 'active' | 'degraded' | 'offline' | 'shadow';
  parameters: number;
  requestsPerSecond: number;
  latencyP50Ms: number;
  latencyP99Ms: number;
  errorRate: number;
  lastUpdated: string;
  lastDeployedAt: string;
  region: string;
}

interface ShadowValidation {
  id: string;
  networkId: CortexNetworkId;
  networkName: string;
  currentVersion: string;
  candidateVersion: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'aborted';
  startedAt: string;
  estimatedEndAt: string;
  progressPercent: number;
  durationMinutes: number;
  metrics: {
    errorRate: number;
    latencyDeltaMs: number;
    outputDivergencePercent: number;
    memoryOverheadPercent: number;
  };
  warnings: string[];
  canAbort: boolean;
}

type NeuralThermalState = 'cold' | 'warming' | 'warm' | 'hot';

interface RegionStatus {
  regionId: string;
  regionName: string;
  status: 'online' | 'degraded' | 'offline';
  thermalState: NeuralThermalState;
  activeCartridge?: {
    id: string;
    name: string;
    version: string;
  };
  networks: {
    total: number;
    active: number;
    degraded: number;
    offline: number;
  };
  latencyMs: number;
  requestsPerSecond: number;
  lastHealthCheck: string;
}

interface NetworkDeployment {
  id: string;
  networkId: CortexNetworkId;
  networkName: string;
  version: string;
  previousVersion?: string;
  status: 'pending' | 'deploying' | 'promoted' | 'rejected' | 'rolled_back';
  deployedAt: string;
  deployedBy: string;
  region: string;
}

interface NeuralAlert {
  id: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  networkId?: CortexNetworkId;
  regionId?: string;
  createdAt: string;
  acknowledged: boolean;
}

interface DashboardData {
  summary: {
    systemStatus: 'healthy' | 'degraded' | 'critical';
    networksActive: number;
    networksTotal: number;
    regionsOnline: number;
    regionsTotal: number;
    alertCount: number;
  };
  networks: CortexNetworkStatus[];
  shadowValidations: ShadowValidation[];
  regions: RegionStatus[];
  recentDeployments: NetworkDeployment[];
  alerts: NeuralAlert[];
}

// =============================================================================
// Component
// =============================================================================

export default function NeuralOperationsPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<RegionStatus | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/neural-operations/dashboard');
      if (!response.ok) throw new Error('Failed to fetch dashboard');
      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 30000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  if (loading && !data) {
    return <DashboardSkeleton />;
  }

  if (error && !data) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={fetchDashboard} className="mt-4" variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  const summary = data?.summary ?? {
    systemStatus: 'healthy',
    networksActive: 6,
    networksTotal: 6,
    regionsOnline: 3,
    regionsTotal: 3,
    alertCount: 0,
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Brain className="h-8 w-8 text-purple-600" />
            Neural Operations Center
          </h1>
          <p className="text-muted-foreground mt-1">
            CORTEX Network Monitoring & Control
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SystemStatusBadge status={summary.systemStatus} />
          <Button onClick={fetchDashboard} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Networks Active"
          value={`${summary.networksActive}/${summary.networksTotal}`}
          subtitle="CORTEX MLPs online"
          icon={<Network className="h-5 w-5" />}
          color="purple"
        />
        <StatCard
          title="Regions Online"
          value={`${summary.regionsOnline}/${summary.regionsTotal}`}
          subtitle="AWS regions healthy"
          icon={<Globe className="h-5 w-5" />}
          color="blue"
        />
        <StatCard
          title="Active Shadows"
          value={data?.shadowValidations.filter(s => s.status === 'running').length ?? 0}
          subtitle="Validations in progress"
          icon={<Shield className="h-5 w-5" />}
          color="amber"
        />
        <StatCard
          title="Alerts"
          value={summary.alertCount}
          subtitle="Unacknowledged"
          icon={<Bell className="h-5 w-5" />}
          color={summary.alertCount > 0 ? 'red' : 'green'}
          alert={summary.alertCount > 0}
        />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: World Map & Regions */}
        <div className="lg:col-span-1 space-y-6">
          <RegionMapCard
            regions={data?.regions ?? []}
            onOverride={(region) => {
              setSelectedRegion(region);
              setOverrideDialogOpen(true);
            }}
          />
        </div>

        {/* Right: Network Status Grid */}
        <div className="lg:col-span-2">
          <NetworkStatusGrid networks={data?.networks ?? []} />
        </div>
      </div>

      {/* Shadow Validations */}
      {(data?.shadowValidations ?? []).length > 0 && (
        <ShadowValidationsCard
          validations={data?.shadowValidations ?? []}
          onAbort={async (id) => {
            await fetch(`/api/admin/neural-operations/shadows/${id}/abort`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reason: 'Manual abort from dashboard' }),
            });
            fetchDashboard();
          }}
        />
      )}

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Deployments */}
        <RecentDeploymentsCard deployments={data?.recentDeployments ?? []} />

        {/* Alerts */}
        <AlertsCard
          alerts={data?.alerts ?? []}
          onAcknowledge={async (id) => {
            await fetch(`/api/admin/neural-operations/alerts/${id}/acknowledge`, {
              method: 'POST',
            });
            fetchDashboard();
          }}
        />
      </div>

      {/* Thermal Override Dialog */}
      <ThermalOverrideDialog
        open={overrideDialogOpen}
        onOpenChange={setOverrideDialogOpen}
        region={selectedRegion}
        onSubmit={async (targetState, reason, duration) => {
          if (!selectedRegion) return;
          await fetch(`/api/admin/neural-operations/regions/${selectedRegion.regionId}/thermal-override`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetState, reason, durationMinutes: duration }),
          });
          setOverrideDialogOpen(false);
          fetchDashboard();
        }}
      />
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function SystemStatusBadge({ status }: { status: 'healthy' | 'degraded' | 'critical' }) {
  const config = {
    healthy: { label: 'System Healthy', variant: 'default' as const, className: 'bg-green-500' },
    degraded: { label: 'Degraded', variant: 'secondary' as const, className: 'bg-yellow-500' },
    critical: { label: 'Critical', variant: 'destructive' as const, className: 'bg-red-500' },
  };
  const { label, className } = config[status];
  return (
    <Badge className={`${className} text-white`}>
      <span className="w-2 h-2 rounded-full bg-white mr-2 animate-pulse" />
      {label}
    </Badge>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  color,
  alert = false,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
  alert?: boolean;
}) {
  const colorClasses: Record<string, string> = {
    purple: 'text-purple-600 bg-purple-50',
    blue: 'text-blue-600 bg-blue-50',
    green: 'text-green-600 bg-green-50',
    amber: 'text-amber-600 bg-amber-50',
    red: 'text-red-600 bg-red-50',
  };
  return (
    <Card className={alert ? 'border-red-300 bg-red-50/50' : ''}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <div className={`p-3 rounded-full ${colorClasses[color] || colorClasses.purple}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RegionMapCard({
  regions,
  onOverride,
}: {
  regions: RegionStatus[];
  onOverride: (region: RegionStatus) => void;
}) {
  const thermalColors: Record<NeuralThermalState, string> = {
    cold: 'bg-blue-500',
    warming: 'bg-yellow-500',
    warm: 'bg-green-500',
    hot: 'bg-red-500',
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Regional Status
        </CardTitle>
        <CardDescription>Thermal state by region</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Simplified World Map */}
        <div className="relative bg-slate-100 rounded-lg p-4 h-40 flex items-center justify-center">
          <div className="grid grid-cols-3 gap-8">
            {regions.map((region) => (
              <div key={region.regionId} className="flex flex-col items-center">
                <div
                  className={`w-4 h-4 rounded-full ${thermalColors[region.thermalState]} animate-pulse`}
                  title={region.regionName}
                />
                <span className="text-xs mt-1 text-center">{region.regionId.split('-')[0].toUpperCase()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Region List */}
        <div className="space-y-2">
          {regions.map((region) => (
            <div
              key={region.regionId}
              className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${thermalColors[region.thermalState]}`} />
                <div>
                  <p className="font-medium text-sm">{region.regionId.toUpperCase()}</p>
                  <p className="text-xs text-muted-foreground">
                    {region.activeCartridge?.name || 'No Cartridge'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {region.thermalState.toUpperCase()}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onOverride(region)}
                >
                  <Thermometer className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function NetworkStatusGrid({ networks }: { networks: CortexNetworkStatus[] }) {
  const statusColors: Record<string, string> = {
    active: 'bg-green-500',
    degraded: 'bg-yellow-500',
    offline: 'bg-red-500',
    shadow: 'bg-purple-500',
  };

  const formatParams = (params: number) => {
    if (params >= 1000000) return `${(params / 1000000).toFixed(1)}M`;
    if (params >= 1000) return `${(params / 1000).toFixed(0)}K`;
    return params.toString();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cpu className="h-5 w-5" />
          CORTEX Networks
        </CardTitle>
        <CardDescription>6 Base MLPs (~2.5M parameters total)</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {networks.map((network) => (
            <div
              key={network.id}
              className="border rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${statusColors[network.status]}`} />
                  <span className="font-medium text-sm">{network.name}</span>
                </div>
                <Badge variant="outline" className="text-xs">
                  {network.version}
                </Badge>
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Params:</span>
                  <span className="font-mono">{formatParams(network.parameters)}</span>
                </div>
                <div className="flex justify-between">
                  <span>RPS:</span>
                  <span className="font-mono">{network.requestsPerSecond.toLocaleString()}/s</span>
                </div>
                <div className="flex justify-between">
                  <span>P99:</span>
                  <span className="font-mono">{network.latencyP99Ms.toFixed(1)}ms</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ShadowValidationsCard({
  validations,
  onAbort,
}: {
  validations: ShadowValidation[];
  onAbort: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Active Shadow Validations
        </CardTitle>
        <CardDescription>Model versions being validated before promotion</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {validations.map((validation) => (
          <div
            key={validation.id}
            className="border rounded-lg p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="font-medium">{validation.networkName}</span>
                <span className="text-muted-foreground mx-2">→</span>
                <Badge variant="secondary">{validation.candidateVersion}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {validation.progressPercent}% ({Math.floor(validation.progressPercent * validation.durationMinutes / 100)}/{validation.durationMinutes} min)
                </span>
                {validation.canAbort && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600"
                    onClick={() => onAbort(validation.id)}
                  >
                    Abort
                  </Button>
                )}
              </div>
            </div>
            <Progress value={validation.progressPercent} className="h-2" />
            <div className="grid grid-cols-4 gap-4 mt-3 text-xs">
              <MetricBadge
                label="Error"
                value={`${(validation.metrics.errorRate * 100).toFixed(3)}%`}
                warn={validation.metrics.errorRate > 0.001}
              />
              <MetricBadge
                label="Latency Δ"
                value={`+${validation.metrics.latencyDeltaMs}ms`}
                warn={validation.metrics.latencyDeltaMs > 50}
              />
              <MetricBadge
                label="Divergence"
                value={`${(validation.metrics.outputDivergencePercent * 100).toFixed(1)}%`}
                warn={validation.metrics.outputDivergencePercent > 0.15}
              />
              <MetricBadge
                label="Memory Δ"
                value={`+${(validation.metrics.memoryOverheadPercent * 100).toFixed(0)}%`}
                warn={validation.metrics.memoryOverheadPercent > 0.20}
              />
            </div>
          </div>
        ))}
        {validations.length === 0 && (
          <p className="text-center text-muted-foreground py-4">
            No active shadow validations
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function MetricBadge({ label, value, warn }: { label: string; value: string; warn: boolean }) {
  return (
    <div className={`p-2 rounded text-center ${warn ? 'bg-yellow-50 text-yellow-700' : 'bg-slate-50'}`}>
      <div className="text-muted-foreground">{label}</div>
      <div className="font-mono font-medium">{value}</div>
    </div>
  );
}

function RecentDeploymentsCard({ deployments }: { deployments: NetworkDeployment[] }) {
  const statusIcons: Record<string, React.ReactNode> = {
    promoted: <CheckCircle className="h-4 w-4 text-green-500" />,
    rejected: <XCircle className="h-4 w-4 text-red-500" />,
    pending: <Clock className="h-4 w-4 text-yellow-500" />,
    deploying: <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />,
    rolled_back: <AlertTriangle className="h-4 w-4 text-orange-500" />,
  };

  const formatTime = (iso: string) => {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHrs < 1) return 'Just now';
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return `${Math.floor(diffHrs / 24)}d ago`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Recent Deployments
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {deployments.slice(0, 5).map((dep) => (
            <div key={dep.id} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {statusIcons[dep.status]}
                <div>
                  <span className="font-medium text-sm">{dep.networkName}</span>
                  <span className="text-muted-foreground mx-1">{dep.version}</span>
                </div>
              </div>
              <span className="text-xs text-muted-foreground">{formatTime(dep.deployedAt)}</span>
            </div>
          ))}
          {deployments.length === 0 && (
            <p className="text-center text-muted-foreground py-2">No recent deployments</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AlertsCard({
  alerts,
  onAcknowledge,
}: {
  alerts: NeuralAlert[];
  onAcknowledge: (id: string) => void;
}) {
  const severityColors: Record<string, string> = {
    critical: 'border-red-500 bg-red-50',
    error: 'border-orange-500 bg-orange-50',
    warning: 'border-yellow-500 bg-yellow-50',
    info: 'border-blue-500 bg-blue-50',
  };

  const unacknowledged = alerts.filter((a) => !a.acknowledged);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Alerts
          {unacknowledged.length > 0 && (
            <Badge variant="destructive" className="ml-2">
              {unacknowledged.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {unacknowledged.slice(0, 5).map((alert) => (
            <div
              key={alert.id}
              className={`border-l-4 p-3 rounded ${severityColors[alert.severity]}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{alert.title}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onAcknowledge(alert.id)}
                >
                  <CheckCircle className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{alert.message}</p>
            </div>
          ))}
          {unacknowledged.length === 0 && (
            <p className="text-center text-muted-foreground py-4">
              <CheckCircle className="h-8 w-8 mx-auto text-green-500 mb-2" />
              No active alerts
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ThermalOverrideDialog({
  open,
  onOpenChange,
  region,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  region: RegionStatus | null;
  onSubmit: (targetState: NeuralThermalState, reason: string, duration?: number) => void;
}) {
  const [targetState, setTargetState] = useState<NeuralThermalState>('warm');
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState('60');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Override Thermal State</DialogTitle>
          <DialogDescription>
            Override thermal state for {region?.regionName || 'region'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Target State</Label>
            <Select value={targetState} onValueChange={(v) => setTargetState(v as NeuralThermalState)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cold">Cold (Minimal resources)</SelectItem>
                <SelectItem value="warming">Warming (Scaling up)</SelectItem>
                <SelectItem value="warm">Warm (Full inference)</SelectItem>
                <SelectItem value="hot">Hot (Auto-scaled)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for override"
            />
          </div>
          <div className="space-y-2">
            <Label>Duration (minutes, empty for permanent)</Label>
            <Input
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="60"
              type="number"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => onSubmit(targetState, reason, duration ? parseInt(duration) : undefined)}
            disabled={!reason}
          >
            Apply Override
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DashboardSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-6">
        <Skeleton className="h-80" />
        <Skeleton className="h-80 col-span-2" />
      </div>
    </div>
  );
}
