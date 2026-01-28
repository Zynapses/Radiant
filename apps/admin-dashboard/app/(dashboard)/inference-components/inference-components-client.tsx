'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Server, 
  Cpu, 
  Thermometer, 
  DollarSign, 
  Activity, 
  Clock, 
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Play,
  Square,
  ArrowUpDown,
  Loader2,
  Zap,
  Snowflake,
  Flame,
  Power,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';

// Types
interface TierAssignment {
  modelId: string;
  modelName?: string;
  currentTier: 'hot' | 'warm' | 'cold' | 'off';
  recommendedTier: 'hot' | 'warm' | 'cold' | 'off';
  tierReason: string;
  requestsLast24h: number;
  requestsLast7d: number;
  avgDailyRequests: number;
  lastRequestAt?: string;
  daysSinceLastRequest: number;
  currentMonthlyCost: number;
  projectedMonthlyCost: number;
  potentialSavings: number;
  tierOverride?: string;
  overrideReason?: string;
  overrideExpiresAt?: string;
  lastEvaluatedAt: string;
}

interface InferenceComponent {
  componentId: string;
  componentName: string;
  modelId: string;
  modelName: string;
  endpointName: string;
  status: 'creating' | 'in_service' | 'updating' | 'deleting' | 'failed' | 'unloaded';
  computeUnits: number;
  currentCopies: number;
  loadTimeMs?: number;
  lastLoadedAt?: string;
  lastUnloadedAt?: string;
  requestsLast24h: number;
  avgLatencyMs: number;
  errorRate: number;
}

interface SharedEndpoint {
  endpointId: string;
  endpointName: string;
  instanceType: string;
  instanceCount: number;
  totalComputeUnits: number;
  allocatedComputeUnits: number;
  availableComputeUnits: number;
  componentCount: number;
  maxComponents: number;
  status: string;
  hourlyBaseCost: number;
}

interface TierTransition {
  transitionId: string;
  modelId: string;
  fromTier: string;
  toTier: string;
  reason: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  errorMessage?: string;
}

interface Dashboard {
  totalModels: number;
  modelsByTier: Record<string, number>;
  totalComponents: number;
  activeComponents: number;
  sharedEndpoints: SharedEndpoint[];
  totalComputeUnits: number;
  usedComputeUnits: number;
  utilizationPercent: number;
  currentMonthCost: number;
  projectedMonthCost: number;
  costByTier: Record<string, number>;
  savingsVsDedicated: number;
  avgLoadTimeMs: number;
  avgLatencyMs: number;
  cacheHitRate: number;
  recentTransitions: TierTransition[];
  lastUpdated: string;
}

interface Config {
  enabled: boolean;
  autoTieringEnabled: boolean;
  predictiveLoadingEnabled: boolean;
  fallbackToExternalEnabled: boolean;
  tierThresholds: {
    hotTierMinRequestsPerDay: number;
    warmTierMinRequestsPerDay: number;
    offTierInactiveDays: number;
  };
  defaultInstanceType: string;
  maxSharedEndpoints: number;
  maxComponentsPerEndpoint: number;
  defaultLoadTimeoutMs: number;
  preloadWindowMinutes: number;
  unloadAfterIdleMinutes: number;
  maxMonthlyBudget?: number;
  alertThresholdPercent: number;
}

const TIER_ICONS = {
  hot: Flame,
  warm: Thermometer,
  cold: Snowflake,
  off: Power,
};

const _TIER_COLORS = {
  hot: 'bg-red-500',
  warm: 'bg-orange-500',
  cold: 'bg-blue-500',
  off: 'bg-gray-500',
};
void _TIER_COLORS; // Reserved for component styling

const TIER_BADGES = {
  hot: 'destructive',
  warm: 'default',
  cold: 'secondary',
  off: 'outline',
} as const;

const STATUS_ICONS = {
  creating: Loader2,
  in_service: CheckCircle,
  updating: RefreshCw,
  deleting: XCircle,
  failed: AlertTriangle,
  unloaded: Snowflake,
};

export function InferenceComponentsClient() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [tierAssignments, setTierAssignments] = useState<TierAssignment[]>([]);
  const [components, setComponents] = useState<InferenceComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [showTransitionDialog, setShowTransitionDialog] = useState(false);
  const [targetTier, setTargetTier] = useState<string>('');
  const [transitionReason, setTransitionReason] = useState('');
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    try {
      const [dashboardRes, configRes, tiersRes, componentsRes] = await Promise.all([
        fetch('/api/admin/inference-components/dashboard'),
        fetch('/api/admin/inference-components/config'),
        fetch('/api/admin/inference-components/tiers'),
        fetch('/api/admin/inference-components/components'),
      ]);

      if (dashboardRes.ok) {
        const data = await dashboardRes.json();
        setDashboard(data.data);
      }
      if (configRes.ok) {
        const data = await configRes.json();
        setConfig(data.data);
      }
      if (tiersRes.ok) {
        const data = await tiersRes.json();
        setTierAssignments(data.data || []);
      }
      if (componentsRes.ok) {
        const data = await componentsRes.json();
        setComponents(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch inference components data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleConfigUpdate = async (updates: Partial<Config>) => {
    try {
      const res = await fetch('/api/admin/inference-components/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data.data);
        toast({ title: 'Configuration updated' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update configuration', variant: 'destructive' });
    }
  };

  const handleTransitionTier = async () => {
    if (!selectedModel || !targetTier) return;
    
    try {
      const res = await fetch(`/api/admin/inference-components/tiers/${selectedModel}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetTier, reason: transitionReason || 'Manual transition' }),
      });
      if (res.ok) {
        toast({ title: 'Tier transition initiated' });
        setShowTransitionDialog(false);
        setSelectedModel(null);
        setTargetTier('');
        setTransitionReason('');
        fetchData();
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to transition tier', variant: 'destructive' });
    }
  };

  const handleLoadComponent = async (componentId: string) => {
    try {
      const res = await fetch(`/api/admin/inference-components/components/${componentId}/load`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority: 'high', reason: 'Manual load from admin' }),
      });
      if (res.ok) {
        toast({ title: 'Component loading initiated' });
        fetchData();
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load component', variant: 'destructive' });
    }
  };

  const handleUnloadComponent = async (componentId: string) => {
    try {
      const res = await fetch(`/api/admin/inference-components/components/${componentId}/unload`, {
        method: 'POST',
      });
      if (res.ok) {
        toast({ title: 'Component unloading initiated' });
        fetchData();
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to unload component', variant: 'destructive' });
    }
  };

  const handleRunAutoTiering = async () => {
    try {
      const res = await fetch('/api/admin/inference-components/auto-tier', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        toast({ 
          title: 'Auto-tiering complete', 
          description: `Evaluated: ${data.data.evaluated}, Transitioned: ${data.data.transitioned}` 
        });
        fetchData();
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to run auto-tiering', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Inference Components</h1>
            <p className="text-muted-foreground">
              Manage self-hosted model hosting tiers and SageMaker infrastructure
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button size="sm" onClick={handleRunAutoTiering}>
              <Zap className="h-4 w-4 mr-2" />
              Run Auto-Tiering
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        {dashboard && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Models</CardTitle>
                <Server className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboard.totalModels}</div>
                <div className="flex gap-2 mt-2">
                  {Object.entries(dashboard.modelsByTier).map(([tier, count]) => {
                    const TierIcon = TIER_ICONS[tier as keyof typeof TIER_ICONS];
                    return (
                      <Tooltip key={tier}>
                        <TooltipTrigger>
                          <Badge variant={TIER_BADGES[tier as keyof typeof TIER_BADGES]} className="gap-1">
                            {TierIcon && <TierIcon className="h-3 w-3" />}
                            {count}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>{tier.toUpperCase()} tier</TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Compute Utilization</CardTitle>
                <Cpu className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboard.utilizationPercent.toFixed(1)}%</div>
                <Progress value={dashboard.utilizationPercent} className="mt-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  {dashboard.usedComputeUnits} / {dashboard.totalComputeUnits} units
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Monthly Cost</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${dashboard.currentMonthCost.toLocaleString()}</div>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingDown className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-green-500">
                    ${dashboard.savingsVsDedicated.toLocaleString()} saved
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Load Time</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(dashboard.avgLoadTimeMs / 1000).toFixed(1)}s</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {dashboard.activeComponents} / {dashboard.totalComponents} active
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Tabs */}
        <Tabs defaultValue="tiers" className="space-y-4">
          <TabsList>
            <TabsTrigger value="tiers">Model Tiers</TabsTrigger>
            <TabsTrigger value="components">Components</TabsTrigger>
            <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
            <TabsTrigger value="transitions">Transitions</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* Model Tiers Tab */}
          <TabsContent value="tiers" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Model Tier Assignments</CardTitle>
                <CardDescription>
                  Current and recommended hosting tiers based on usage patterns
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Model</TableHead>
                      <TableHead>Current Tier</TableHead>
                      <TableHead>Recommended</TableHead>
                      <TableHead>Requests (24h)</TableHead>
                      <TableHead>Avg Daily</TableHead>
                      <TableHead>Monthly Cost</TableHead>
                      <TableHead>Savings</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tierAssignments.map((assignment) => {
                      const CurrentIcon = TIER_ICONS[assignment.currentTier];
                      const RecommendedIcon = TIER_ICONS[assignment.recommendedTier];
                      const needsChange = assignment.currentTier !== assignment.recommendedTier;
                      
                      return (
                        <TableRow key={assignment.modelId}>
                          <TableCell className="font-medium">
                            <div>
                              <div>{assignment.modelId}</div>
                              {assignment.tierOverride && (
                                <Badge variant="outline" className="text-xs mt-1">Override</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={TIER_BADGES[assignment.currentTier]} className="gap-1">
                              <CurrentIcon className="h-3 w-3" />
                              {assignment.currentTier.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {needsChange ? (
                              <Badge variant="outline" className="gap-1 border-yellow-500 text-yellow-600">
                                <RecommendedIcon className="h-3 w-3" />
                                {assignment.recommendedTier.toUpperCase()}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                          <TableCell>{assignment.requestsLast24h.toLocaleString()}</TableCell>
                          <TableCell>{assignment.avgDailyRequests.toFixed(1)}</TableCell>
                          <TableCell>${assignment.currentMonthlyCost.toFixed(0)}</TableCell>
                          <TableCell>
                            {assignment.potentialSavings > 0 ? (
                              <span className="text-green-500">
                                +${assignment.potentialSavings.toFixed(0)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Dialog open={showTransitionDialog && selectedModel === assignment.modelId} onOpenChange={(open) => {
                              setShowTransitionDialog(open);
                              if (!open) setSelectedModel(null);
                            }}>
                              <DialogTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => setSelectedModel(assignment.modelId)}
                                >
                                  <ArrowUpDown className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Change Tier</DialogTitle>
                                  <DialogDescription>
                                    Transition {assignment.modelId} to a different hosting tier
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                  <div className="space-y-2">
                                    <Label>Target Tier</Label>
                                    <Select value={targetTier} onValueChange={setTargetTier}>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select tier" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="hot">HOT - Dedicated endpoint</SelectItem>
                                        <SelectItem value="warm">WARM - Inference Component</SelectItem>
                                        <SelectItem value="cold">COLD - Serverless</SelectItem>
                                        <SelectItem value="off">OFF - Not deployed</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Reason (optional)</Label>
                                    <Input 
                                      value={transitionReason}
                                      onChange={(e) => setTransitionReason(e.target.value)}
                                      placeholder="e.g., High priority demo"
                                    />
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button variant="outline" onClick={() => setShowTransitionDialog(false)}>
                                    Cancel
                                  </Button>
                                  <Button onClick={handleTransitionTier} disabled={!targetTier}>
                                    Transition
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {tierAssignments.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          No tier assignments yet. Run auto-tiering to evaluate models.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Components Tab */}
          <TabsContent value="components" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Inference Components</CardTitle>
                <CardDescription>
                  Active model components on shared SageMaker endpoints
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Model</TableHead>
                      <TableHead>Endpoint</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Compute</TableHead>
                      <TableHead>Copies</TableHead>
                      <TableHead>Load Time</TableHead>
                      <TableHead>Last Loaded</TableHead>
                      <TableHead>Requests (24h)</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {components.map((component) => {
                      const StatusIcon = STATUS_ICONS[component.status] || Activity;
                      const isLoaded = component.status === 'in_service' && component.currentCopies > 0;
                      
                      return (
                        <TableRow key={component.componentId}>
                          <TableCell className="font-medium">{component.modelName}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {component.endpointName.substring(0, 20)}...
                          </TableCell>
                          <TableCell>
                            <Badge variant={component.status === 'in_service' ? 'default' : 'secondary'} className="gap-1">
                              <StatusIcon className={`h-3 w-3 ${component.status === 'creating' || component.status === 'updating' ? 'animate-spin' : ''}`} />
                              {component.status.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell>{component.computeUnits} units</TableCell>
                          <TableCell>{component.currentCopies}</TableCell>
                          <TableCell>
                            {component.loadTimeMs ? `${(component.loadTimeMs / 1000).toFixed(1)}s` : '—'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {component.lastLoadedAt 
                              ? new Date(component.lastLoadedAt).toLocaleString() 
                              : '—'}
                          </TableCell>
                          <TableCell>{component.requestsLast24h.toLocaleString()}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {isLoaded ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button 
                                      variant="outline" 
                                      size="sm"
                                      onClick={() => handleUnloadComponent(component.componentId)}
                                    >
                                      <Square className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Unload model</TooltipContent>
                                </Tooltip>
                              ) : (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button 
                                      variant="outline" 
                                      size="sm"
                                      onClick={() => handleLoadComponent(component.componentId)}
                                    >
                                      <Play className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Load model</TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {components.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                          No inference components yet. Models in WARM tier will appear here.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Endpoints Tab */}
          <TabsContent value="endpoints" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Shared Endpoints</CardTitle>
                <CardDescription>
                  SageMaker endpoints hosting multiple inference components
                </CardDescription>
              </CardHeader>
              <CardContent>
                {dashboard?.sharedEndpoints && dashboard.sharedEndpoints.length > 0 ? (
                  <div className="grid gap-4">
                    {dashboard.sharedEndpoints.map((endpoint) => (
                      <Card key={endpoint.endpointId}>
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-semibold">{endpoint.endpointName}</h4>
                              <p className="text-sm text-muted-foreground">{endpoint.instanceType} × {endpoint.instanceCount}</p>
                            </div>
                            <Badge variant={endpoint.status === 'in_service' ? 'default' : 'secondary'}>
                              {endpoint.status.replace('_', ' ')}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-4 gap-4 mt-4">
                            <div>
                              <p className="text-sm text-muted-foreground">Components</p>
                              <p className="text-lg font-semibold">{endpoint.componentCount} / {endpoint.maxComponents}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Compute Used</p>
                              <p className="text-lg font-semibold">
                                {endpoint.allocatedComputeUnits} / {endpoint.totalComputeUnits}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Utilization</p>
                              <Progress 
                                value={(endpoint.allocatedComputeUnits / endpoint.totalComputeUnits) * 100} 
                                className="mt-2"
                              />
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Hourly Cost</p>
                              <p className="text-lg font-semibold">${endpoint.hourlyBaseCost.toFixed(2)}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    No shared endpoints yet. They will be created when models are assigned to WARM tier.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Transitions Tab */}
          <TabsContent value="transitions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Tier Transitions</CardTitle>
                <CardDescription>
                  History of model hosting tier changes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Model</TableHead>
                      <TableHead>From</TableHead>
                      <TableHead>To</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Completed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboard?.recentTransitions?.map((transition) => (
                      <TableRow key={transition.transitionId}>
                        <TableCell className="font-medium">{transition.modelId}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{transition.fromTier.toUpperCase()}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{transition.toTier.toUpperCase()}</Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">{transition.reason}</TableCell>
                        <TableCell>
                          <Badge variant={transition.status === 'completed' ? 'default' : 
                                         transition.status === 'failed' ? 'destructive' : 'secondary'}>
                            {transition.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {new Date(transition.startedAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-sm">
                          {transition.completedAt 
                            ? new Date(transition.completedAt).toLocaleString() 
                            : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!dashboard?.recentTransitions || dashboard.recentTransitions.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          No tier transitions yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4">
            {config && (
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Feature Flags</CardTitle>
                    <CardDescription>Enable or disable inference components features</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Inference Components</Label>
                        <p className="text-sm text-muted-foreground">Enable tiered model hosting</p>
                      </div>
                      <Switch 
                        checked={config.enabled} 
                        onCheckedChange={(enabled) => handleConfigUpdate({ enabled })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Auto-Tiering</Label>
                        <p className="text-sm text-muted-foreground">Automatically adjust tiers based on usage</p>
                      </div>
                      <Switch 
                        checked={config.autoTieringEnabled} 
                        onCheckedChange={(autoTieringEnabled) => handleConfigUpdate({ autoTieringEnabled })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Predictive Loading</Label>
                        <p className="text-sm text-muted-foreground">Pre-load models before predicted usage</p>
                      </div>
                      <Switch 
                        checked={config.predictiveLoadingEnabled} 
                        onCheckedChange={(predictiveLoadingEnabled) => handleConfigUpdate({ predictiveLoadingEnabled })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Fallback to External</Label>
                        <p className="text-sm text-muted-foreground">Use external provider while model loads</p>
                      </div>
                      <Switch 
                        checked={config.fallbackToExternalEnabled} 
                        onCheckedChange={(fallbackToExternalEnabled) => handleConfigUpdate({ fallbackToExternalEnabled })}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Tier Thresholds</CardTitle>
                    <CardDescription>Usage thresholds for automatic tier assignment</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>HOT Tier (min requests/day)</Label>
                      <Input 
                        type="number"
                        value={config.tierThresholds.hotTierMinRequestsPerDay}
                        onChange={(e) => handleConfigUpdate({ 
                          tierThresholds: { 
                            ...config.tierThresholds, 
                            hotTierMinRequestsPerDay: parseInt(e.target.value) 
                          }
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>WARM Tier (min requests/day)</Label>
                      <Input 
                        type="number"
                        value={config.tierThresholds.warmTierMinRequestsPerDay}
                        onChange={(e) => handleConfigUpdate({ 
                          tierThresholds: { 
                            ...config.tierThresholds, 
                            warmTierMinRequestsPerDay: parseInt(e.target.value) 
                          }
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>OFF Tier (inactive days)</Label>
                      <Input 
                        type="number"
                        value={config.tierThresholds.offTierInactiveDays}
                        onChange={(e) => handleConfigUpdate({ 
                          tierThresholds: { 
                            ...config.tierThresholds, 
                            offTierInactiveDays: parseInt(e.target.value) 
                          }
                        })}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Infrastructure</CardTitle>
                    <CardDescription>SageMaker infrastructure settings</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Default Instance Type</Label>
                      <Select 
                        value={config.defaultInstanceType} 
                        onValueChange={(defaultInstanceType) => handleConfigUpdate({ defaultInstanceType })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ml.g5.xlarge">ml.g5.xlarge ($1.41/hr)</SelectItem>
                          <SelectItem value="ml.g5.2xlarge">ml.g5.2xlarge ($2.82/hr)</SelectItem>
                          <SelectItem value="ml.g5.4xlarge">ml.g5.4xlarge ($5.63/hr)</SelectItem>
                          <SelectItem value="ml.inf2.xlarge">ml.inf2.xlarge ($0.76/hr)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Max Shared Endpoints</Label>
                      <Input 
                        type="number"
                        value={config.maxSharedEndpoints}
                        onChange={(e) => handleConfigUpdate({ maxSharedEndpoints: parseInt(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Max Components per Endpoint</Label>
                      <Input 
                        type="number"
                        value={config.maxComponentsPerEndpoint}
                        onChange={(e) => handleConfigUpdate({ maxComponentsPerEndpoint: parseInt(e.target.value) })}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Timing</CardTitle>
                    <CardDescription>Loading and unloading behavior</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Load Timeout (ms)</Label>
                      <Input 
                        type="number"
                        value={config.defaultLoadTimeoutMs}
                        onChange={(e) => handleConfigUpdate({ defaultLoadTimeoutMs: parseInt(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Preload Window (minutes)</Label>
                      <Input 
                        type="number"
                        value={config.preloadWindowMinutes}
                        onChange={(e) => handleConfigUpdate({ preloadWindowMinutes: parseInt(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Unload After Idle (minutes)</Label>
                      <Input 
                        type="number"
                        value={config.unloadAfterIdleMinutes}
                        onChange={(e) => handleConfigUpdate({ unloadAfterIdleMinutes: parseInt(e.target.value) })}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}
