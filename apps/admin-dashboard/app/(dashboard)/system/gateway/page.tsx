'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/lib/api/client';
import {
  RefreshCw,
  Save,
  Zap,
  Cpu,
  HardDrive,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Settings,
  Scale,
  Timer,
  Shield,
  Globe,
} from 'lucide-react';
import type { LiteLLMGatewayConfig, LiteLLMGatewayHealth } from '@radiant/shared';

export default function GatewayConfigPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [hasChanges, setHasChanges] = useState(false);
  const [localConfig, setLocalConfig] = useState<Partial<LiteLLMGatewayConfig>>({});

  const { data: health, isLoading: healthLoading, refetch: refetchHealth } = useQuery({
    queryKey: ['gateway-health'],
    queryFn: async () => {
      const response = await api.get<{ data: LiteLLMGatewayHealth }>('/api/admin/system/gateway');
      return response.data;
    },
    refetchInterval: 30000,
  });

  const { data: config, isLoading: configLoading, refetch: refetchConfig } = useQuery({
    queryKey: ['gateway-config'],
    queryFn: async () => {
      const response = await api.get<{ data: LiteLLMGatewayConfig }>('/api/admin/system/gateway/config');
      return response.data;
    },
  });

  // Set local config when config data changes
  if (config && Object.keys(localConfig).length === 0) {
    setLocalConfig(config);
  }

  const updateConfigMutation = useMutation({
    mutationFn: async (updates: Partial<LiteLLMGatewayConfig>) => {
      await api.put('/api/admin/system/gateway/config', updates);
    },
    onSuccess: () => {
      toast({ title: 'Gateway configuration updated successfully' });
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ['gateway-config'] });
      queryClient.invalidateQueries({ queryKey: ['gateway-health'] });
    },
    onError: (error) => {
      toast({ 
        title: 'Failed to update configuration', 
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive' 
      });
    },
  });

  const handleConfigChange = <K extends keyof LiteLLMGatewayConfig>(
    key: K, 
    value: LiteLLMGatewayConfig[K]
  ) => {
    setLocalConfig(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    updateConfigMutation.mutate(localConfig);
  };

  const handleReset = () => {
    if (config) {
      setLocalConfig(config);
      setHasChanges(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'degraded': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'unhealthy': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const isLoading = healthLoading || configLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">LiteLLM Gateway Configuration</h1>
          <p className="text-muted-foreground">
            Configure auto-scaling, rate limiting, and health check settings
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { refetchHealth(); refetchConfig(); }}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {hasChanges && (
            <>
              <Button variant="outline" size="sm" onClick={handleReset}>
                Reset
              </Button>
              <Button size="sm" onClick={handleSave} disabled={updateConfigMutation.isPending}>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Health Status Cards */}
      {health && (
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Status</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <Badge className={getStatusColor(health.status)}>
                {health.status.charAt(0).toUpperCase() + health.status.slice(1)}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Running Tasks</CardTitle>
              <Cpu className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {health.runningTasks} / {health.desiredTasks}
              </div>
              <p className="text-xs text-muted-foreground">
                {health.healthyTargets} healthy, {health.unhealthyTargets} unhealthy
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">CPU</CardTitle>
              <Cpu className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{health.cpuUtilization.toFixed(1)}%</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Memory</CardTitle>
              <HardDrive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{health.memoryUtilization.toFixed(1)}%</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Requests/sec</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{health.requestsPerSecond}</div>
              <p className="text-xs text-muted-foreground">
                P50: {health.latencyP50Ms}ms | P99: {health.latencyP99Ms}ms
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Provider Status */}
      {health?.providers && health.providers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Provider Status
            </CardTitle>
            <CardDescription>Real-time status of upstream AI providers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {health.providers.map((provider) => (
                <div key={provider.provider} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{provider.provider}</p>
                    <p className="text-xs text-muted-foreground">
                      {provider.models.slice(0, 2).join(', ')}
                      {provider.models.length > 2 && ` +${provider.models.length - 2} more`}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge className={getStatusColor(provider.status === 'available' ? 'healthy' : 'degraded')}>
                      {provider.status}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {provider.latencyMs}ms
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Configuration Tabs */}
      <Tabs defaultValue="scaling" className="space-y-4">
        <TabsList>
          <TabsTrigger value="scaling">
            <Scale className="h-4 w-4 mr-2" />
            Auto-Scaling
          </TabsTrigger>
          <TabsTrigger value="health">
            <Activity className="h-4 w-4 mr-2" />
            Health Checks
          </TabsTrigger>
          <TabsTrigger value="rate-limiting">
            <Shield className="h-4 w-4 mr-2" />
            Rate Limiting
          </TabsTrigger>
          <TabsTrigger value="timeouts">
            <Timer className="h-4 w-4 mr-2" />
            Timeouts & Retries
          </TabsTrigger>
        </TabsList>

        {/* Auto-Scaling Tab */}
        <TabsContent value="scaling" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Task Scaling</CardTitle>
              <CardDescription>Configure ECS Fargate task scaling parameters</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Minimum Tasks</Label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={localConfig.minTasks || 2}
                    onChange={(e) => handleConfigChange('minTasks', parseInt(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">Minimum number of running tasks</p>
                </div>
                <div className="space-y-2">
                  <Label>Maximum Tasks</Label>
                  <Input
                    type="number"
                    min={1}
                    max={500}
                    value={localConfig.maxTasks || 50}
                    onChange={(e) => handleConfigChange('maxTasks', parseInt(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">Maximum number of running tasks</p>
                </div>
                <div className="space-y-2">
                  <Label>Desired Tasks</Label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={localConfig.desiredTasks || 2}
                    onChange={(e) => handleConfigChange('desiredTasks', parseInt(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">Initial desired task count</p>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Task CPU (vCPU units)</Label>
                  <Input
                    type="number"
                    min={256}
                    max={16384}
                    step={256}
                    value={localConfig.taskCpu || 2048}
                    onChange={(e) => handleConfigChange('taskCpu', parseInt(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">256 = 0.25 vCPU, 1024 = 1 vCPU</p>
                </div>
                <div className="space-y-2">
                  <Label>Task Memory (MB)</Label>
                  <Input
                    type="number"
                    min={512}
                    max={122880}
                    step={512}
                    value={localConfig.taskMemory || 4096}
                    onChange={(e) => handleConfigChange('taskMemory', parseInt(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">Memory allocation per task</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Scaling Thresholds</CardTitle>
              <CardDescription>Configure when scaling actions are triggered</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Target CPU Utilization</Label>
                    <span className="text-sm font-medium">{localConfig.targetCpuUtilization || 70}%</span>
                  </div>
                  <Slider
                    value={[localConfig.targetCpuUtilization || 70]}
                    onValueChange={([value]) => handleConfigChange('targetCpuUtilization', value)}
                    min={10}
                    max={95}
                    step={5}
                  />
                  <p className="text-xs text-muted-foreground">Scale out when CPU exceeds this threshold</p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Target Memory Utilization</Label>
                    <span className="text-sm font-medium">{localConfig.targetMemoryUtilization || 80}%</span>
                  </div>
                  <Slider
                    value={[localConfig.targetMemoryUtilization || 80]}
                    onValueChange={([value]) => handleConfigChange('targetMemoryUtilization', value)}
                    min={10}
                    max={95}
                    step={5}
                  />
                  <p className="text-xs text-muted-foreground">Scale out when memory exceeds this threshold</p>
                </div>

                <div className="space-y-2">
                  <Label>Target Requests Per Target</Label>
                  <Input
                    type="number"
                    min={100}
                    max={10000}
                    value={localConfig.targetRequestsPerTarget || 1000}
                    onChange={(e) => handleConfigChange('targetRequestsPerTarget', parseInt(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">Scale out when requests per target exceed this</p>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Scale Out Cooldown (seconds)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={600}
                    value={localConfig.scaleOutCooldownSeconds || 60}
                    onChange={(e) => handleConfigChange('scaleOutCooldownSeconds', parseInt(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">Wait time between scale out events</p>
                </div>
                <div className="space-y-2">
                  <Label>Scale In Cooldown (seconds)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={600}
                    value={localConfig.scaleInCooldownSeconds || 300}
                    onChange={(e) => handleConfigChange('scaleInCooldownSeconds', parseInt(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">Wait time between scale in events</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Health Checks Tab */}
        <TabsContent value="health" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Health Check Settings</CardTitle>
              <CardDescription>Configure ALB health check parameters</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Health Check Path</Label>
                <Input
                  value={localConfig.healthCheckPath || '/health'}
                  onChange={(e) => handleConfigChange('healthCheckPath', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Endpoint for health checks</p>
              </div>

              <div className="grid gap-6 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Check Interval (seconds)</Label>
                  <Input
                    type="number"
                    min={5}
                    max={300}
                    value={localConfig.healthCheckIntervalSeconds || 30}
                    onChange={(e) => handleConfigChange('healthCheckIntervalSeconds', parseInt(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Timeout (seconds)</Label>
                  <Input
                    type="number"
                    min={2}
                    max={120}
                    value={localConfig.healthCheckTimeoutSeconds || 10}
                    onChange={(e) => handleConfigChange('healthCheckTimeoutSeconds', parseInt(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unhealthy Threshold</Label>
                  <Input
                    type="number"
                    min={2}
                    max={10}
                    value={localConfig.unhealthyThresholdCount || 3}
                    onChange={(e) => handleConfigChange('unhealthyThresholdCount', parseInt(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">Failed checks before unhealthy</p>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Deregistration Delay (seconds)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={3600}
                    value={localConfig.deregistrationDelaySeconds || 30}
                    onChange={(e) => handleConfigChange('deregistrationDelaySeconds', parseInt(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">Time to drain connections before deregistration</p>
                </div>
                <div className="space-y-2">
                  <Label>Idle Timeout (seconds)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={4000}
                    value={localConfig.idleTimeoutSeconds || 60}
                    onChange={(e) => handleConfigChange('idleTimeoutSeconds', parseInt(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">Connection idle timeout</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rate Limiting Tab */}
        <TabsContent value="rate-limiting" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Rate Limiting</CardTitle>
              <CardDescription>Configure request rate limits and caching</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Global Rate Limit (requests/second)</Label>
                  <Input
                    type="number"
                    min={100}
                    max={100000}
                    value={localConfig.globalRateLimitPerSecond || 10000}
                    onChange={(e) => handleConfigChange('globalRateLimitPerSecond', parseInt(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">Maximum requests per second across all tenants</p>
                </div>
                <div className="space-y-2">
                  <Label>Per-Tenant Rate Limit (requests/minute)</Label>
                  <Input
                    type="number"
                    min={10}
                    max={10000}
                    value={localConfig.perTenantRateLimitPerMinute || 1000}
                    onChange={(e) => handleConfigChange('perTenantRateLimitPerMinute', parseInt(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">Maximum requests per minute per tenant</p>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable Response Caching</Label>
                    <p className="text-xs text-muted-foreground">Cache identical requests to reduce costs</p>
                  </div>
                  <Switch
                    checked={localConfig.enableResponseCaching ?? true}
                    onCheckedChange={(checked) => handleConfigChange('enableResponseCaching', checked)}
                  />
                </div>

                {localConfig.enableResponseCaching && (
                  <div className="space-y-2">
                    <Label>Cache TTL (seconds)</Label>
                    <Input
                      type="number"
                      min={60}
                      max={86400}
                      value={localConfig.cacheTtlSeconds || 3600}
                      onChange={(e) => handleConfigChange('cacheTtlSeconds', parseInt(e.target.value))}
                    />
                    <p className="text-xs text-muted-foreground">How long to cache responses</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Timeouts Tab */}
        <TabsContent value="timeouts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Timeouts & Retries</CardTitle>
              <CardDescription>Configure request timeout and retry behavior</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Request Timeout (seconds)</Label>
                  <Input
                    type="number"
                    min={30}
                    max={900}
                    value={localConfig.requestTimeoutSeconds || 600}
                    onChange={(e) => handleConfigChange('requestTimeoutSeconds', parseInt(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">Maximum time to wait for a response</p>
                </div>
                <div className="space-y-2">
                  <Label>Connection Timeout (seconds)</Label>
                  <Input
                    type="number"
                    min={5}
                    max={120}
                    value={localConfig.connectionTimeoutSeconds || 30}
                    onChange={(e) => handleConfigChange('connectionTimeoutSeconds', parseInt(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">Maximum time to establish connection</p>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Max Retries</Label>
                  <Input
                    type="number"
                    min={0}
                    max={10}
                    value={localConfig.maxRetries || 3}
                    onChange={(e) => handleConfigChange('maxRetries', parseInt(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">Number of retry attempts on failure</p>
                </div>
                <div className="space-y-2">
                  <Label>Retry Delay (ms)</Label>
                  <Input
                    type="number"
                    min={100}
                    max={10000}
                    value={localConfig.retryDelayMs || 1000}
                    onChange={(e) => handleConfigChange('retryDelayMs', parseInt(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">Initial delay between retries (exponential backoff)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Last Updated Info */}
      {config?.updatedAt && (
        <p className="text-xs text-muted-foreground text-right">
          Last updated: {new Date(config.updatedAt).toLocaleString()} by {config.updatedBy}
        </p>
      )}
    </div>
  );
}
