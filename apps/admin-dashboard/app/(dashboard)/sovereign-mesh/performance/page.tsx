'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  Database, 
  Layers, 
  RefreshCw, 
  Server, 
  TrendingUp,
  Cpu,
  Timer,
  Shield,
  Bell,
  Lightbulb
} from 'lucide-react';

interface PerformanceDashboard {
  tenantId: string;
  generatedAt: string;
  healthScore: number;
  healthStatus: 'healthy' | 'degraded' | 'critical';
  activeExecutions: number;
  pendingExecutions: number;
  executionsLast24h: number;
  avgExecutionDurationSeconds: number;
  agentQueueMetrics: {
    queueName: string;
    approximateMessages: number;
    approximateMessagesNotVisible: number;
    approximateMessagesDelayed: number;
    oldestMessageAgeSeconds: number;
    dlqMessages: number;
  };
  transparencyQueueMetrics: {
    queueName: string;
    approximateMessages: number;
    dlqMessages: number;
  };
  agentCacheMetrics: {
    backend: string;
    hitCount: number;
    missCount: number;
    hitRate: number;
    evictionCount: number;
    memoryUsageBytes: number;
    avgLatencyMs: number;
  };
  oodaPhaseMetrics: Array<{
    phase: string;
    executionCount: number;
    avgDurationMs: number;
    errorCount: number;
    errorRate: number;
  }>;
  activeAlerts: Array<{
    id: string;
    type: string;
    severity: 'warning' | 'critical';
    message: string;
    triggeredAt: string;
  }>;
  estimatedMonthlyCost: number;
}

interface PerformanceConfig {
  agentWorkerConfig: {
    reservedConcurrency: number;
    provisionedConcurrency: number;
    maxConcurrency: number;
    memoryMb: number;
    timeoutSeconds: number;
  };
  transparencyWorkerConfig: {
    maxConcurrency: number;
    memoryMb: number;
  };
  scalingConfig: {
    strategy: 'fixed' | 'auto' | 'scheduled';
    minInstances: number;
    maxInstances: number;
    targetUtilization: number;
  };
  tenantIsolationConfig: {
    mode: 'shared' | 'dedicated' | 'fifo';
    maxConcurrentPerTenant: number;
    maxConcurrentPerUser: number;
    rateLimitingEnabled: boolean;
  };
  alertConfig: {
    dlqAlertEnabled: boolean;
    dlqAlertThreshold: number;
    latencyAlertEnabled: boolean;
    latencyAlertThresholdMs: number;
  };
}

interface Recommendation {
  id: string;
  category: string;
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  currentValue: string;
  recommendedValue: string;
  estimatedImpact: string;
  autoApplyAvailable: boolean;
}

type PendingChanges = {
  agentWorkerConfig?: Partial<PerformanceConfig['agentWorkerConfig']>;
  transparencyWorkerConfig?: Partial<PerformanceConfig['transparencyWorkerConfig']>;
  scalingConfig?: Partial<PerformanceConfig['scalingConfig']>;
  tenantIsolationConfig?: Partial<PerformanceConfig['tenantIsolationConfig']>;
  alertConfig?: Partial<PerformanceConfig['alertConfig']>;
};

export default function SovereignMeshPerformancePage() {
  const [dashboard, setDashboard] = useState<PerformanceDashboard | null>(null);
  const [config, setConfig] = useState<PerformanceConfig | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [pendingChanges, setPendingChanges] = useState<PendingChanges>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [dashboardRes, configRes, recsRes] = await Promise.all([
        fetch('/api/admin/sovereign-mesh/performance/dashboard'),
        fetch('/api/admin/sovereign-mesh/performance/config'),
        fetch('/api/admin/sovereign-mesh/performance/recommendations'),
      ]);

      if (dashboardRes.ok) {
        setDashboard(await dashboardRes.json());
      }
      if (configRes.ok) {
        const data = await configRes.json();
        setConfig(data.config);
      }
      if (recsRes.ok) {
        const data = await recsRes.json();
        setRecommendations(data.recommendations || []);
      }
    } catch (error) {
      console.error('Failed to fetch performance data:', error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const saveConfig = async () => {
    if (Object.keys(pendingChanges).length === 0) return;
    
    setSaving(true);
    try {
      const res = await fetch('/api/admin/sovereign-mesh/performance/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pendingChanges),
      });
      if (res.ok) {
        await fetchData();
        setPendingChanges({});
      }
    } catch (error) {
      console.error('Failed to save config:', error);
    }
    setSaving(false);
  };

  const applyRecommendation = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/sovereign-mesh/performance/recommendations/${id}/apply`, {
        method: 'POST',
      });
      if (res.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error('Failed to apply recommendation:', error);
    }
  };

  const acknowledgeAlert = async (alertId: string) => {
    try {
      await fetch(`/api/admin/sovereign-mesh/performance/alerts/${alertId}/acknowledge`, {
        method: 'POST',
      });
      await fetchData();
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
    }
  };

  const updatePendingChange = (path: string, value: unknown) => {
    setPendingChanges(prev => {
      const parts = path.split('.');
      const result = { ...prev } as Record<string, Record<string, unknown>>;
      
      for (let i = 0; i < parts.length - 1; i++) {
        if (!result[parts[i]]) {
          result[parts[i]] = {};
        }
      }
      if (parts.length === 2) {
        result[parts[0]] = { ...result[parts[0]], [parts[1]]: value };
      }
      
      return result as PendingChanges;
    });
  };

  if (loading && !dashboard) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const healthColor = dashboard?.healthStatus === 'healthy' 
    ? 'text-green-500' 
    : dashboard?.healthStatus === 'degraded' 
      ? 'text-yellow-500' 
      : 'text-red-500';

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sovereign Mesh Performance</h1>
          <p className="text-muted-foreground">
            Monitor and optimize autonomous agent execution at scale
          </p>
        </div>
        <div className="flex items-center gap-4">
          {Object.keys(pendingChanges).length > 0 && (
            <Button onClick={saveConfig} disabled={saving}>
              {saving ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          )}
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Health Score Banner */}
      {dashboard && (
        <Card className={`border-l-4 ${
          dashboard.healthStatus === 'healthy' ? 'border-l-green-500' :
          dashboard.healthStatus === 'degraded' ? 'border-l-yellow-500' :
          'border-l-red-500'
        }`}>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`text-4xl font-bold ${healthColor}`}>
                  {dashboard.healthScore}
                </div>
                <div>
                  <div className="font-semibold">Health Score</div>
                  <div className="text-sm text-muted-foreground capitalize">
                    Status: {dashboard.healthStatus}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-8 text-center">
                <div>
                  <div className="text-2xl font-bold">{dashboard.activeExecutions}</div>
                  <div className="text-sm text-muted-foreground">Active</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{dashboard.pendingExecutions}</div>
                  <div className="text-sm text-muted-foreground">Pending</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{dashboard.executionsLast24h}</div>
                  <div className="text-sm text-muted-foreground">Last 24h</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">
                    ${dashboard.estimatedMonthlyCost.toFixed(2)}
                  </div>
                  <div className="text-sm text-muted-foreground">Est. Monthly</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Alerts */}
      {dashboard?.activeAlerts && dashboard.activeAlerts.length > 0 && (
        <div className="space-y-2">
          {dashboard.activeAlerts.map(alert => (
            <Alert key={alert.id} variant={alert.severity === 'critical' ? 'destructive' : 'default'}>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle className="flex items-center justify-between">
                <span>{alert.type.replace(/_/g, ' ').toUpperCase()}</span>
                <Button size="sm" variant="outline" onClick={() => acknowledgeAlert(alert.id)}>
                  Acknowledge
                </Button>
              </AlertTitle>
              <AlertDescription>{alert.message}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">
            <Activity className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="scaling">
            <Layers className="w-4 h-4 mr-2" />
            Scaling
          </TabsTrigger>
          <TabsTrigger value="caching">
            <Database className="w-4 h-4 mr-2" />
            Caching
          </TabsTrigger>
          <TabsTrigger value="alerts">
            <Bell className="w-4 h-4 mr-2" />
            Alerts
          </TabsTrigger>
          <TabsTrigger value="recommendations">
            <Lightbulb className="w-4 h-4 mr-2" />
            Recommendations
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Queue Metrics */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center">
                  <Server className="w-4 h-4 mr-2" />
                  Agent Queue
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {dashboard?.agentQueueMetrics.approximateMessages || 0}
                </div>
                <p className="text-xs text-muted-foreground">Messages pending</p>
                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>In-flight</span>
                    <span>{dashboard?.agentQueueMetrics.approximateMessagesNotVisible || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>DLQ</span>
                    <span className={dashboard?.agentQueueMetrics.dlqMessages ? 'text-red-500' : ''}>
                      {dashboard?.agentQueueMetrics.dlqMessages || 0}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cache Metrics */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center">
                  <Database className="w-4 h-4 mr-2" />
                  Cache Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {((dashboard?.agentCacheMetrics.hitRate || 0) * 100).toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">Hit rate</p>
                <Progress 
                  value={(dashboard?.agentCacheMetrics.hitRate || 0) * 100} 
                  className="mt-2 h-2"
                />
                <div className="mt-2 text-sm flex justify-between">
                  <span>Hits: {dashboard?.agentCacheMetrics.hitCount || 0}</span>
                  <span>Misses: {dashboard?.agentCacheMetrics.missCount || 0}</span>
                </div>
              </CardContent>
            </Card>

            {/* OODA Performance */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center">
                  <Timer className="w-4 h-4 mr-2" />
                  Avg Duration
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {dashboard?.avgExecutionDurationSeconds.toFixed(1)}s
                </div>
                <p className="text-xs text-muted-foreground">Per execution</p>
                <div className="mt-2 space-y-1">
                  {dashboard?.oodaPhaseMetrics.slice(0, 4).map(phase => (
                    <div key={phase.phase} className="flex justify-between text-sm">
                      <span className="capitalize">{phase.phase}</span>
                      <span>{phase.avgDurationMs.toFixed(0)}ms</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Cost Card */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Cost Estimate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${dashboard?.estimatedMonthlyCost.toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">Monthly estimate</p>
                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Lambda</span>
                    <span>${(dashboard?.estimatedMonthlyCost || 0 * 0.7).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>SQS</span>
                    <span>${(dashboard?.estimatedMonthlyCost || 0 * 0.1).toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Scaling Tab */}
        <TabsContent value="scaling" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Lambda Concurrency */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Cpu className="w-5 h-5 mr-2" />
                  Lambda Concurrency
                </CardTitle>
                <CardDescription>
                  Configure concurrent execution limits
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Max Concurrency: {config?.agentWorkerConfig.maxConcurrency || 50}</Label>
                  <Slider
                    value={[pendingChanges.agentWorkerConfig?.maxConcurrency as number || config?.agentWorkerConfig.maxConcurrency || 50]}
                    min={1}
                    max={200}
                    step={5}
                    onValueChange={([v]) => updatePendingChange('agentWorkerConfig.maxConcurrency', v)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum concurrent Lambda executions from SQS
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Provisioned Concurrency: {config?.agentWorkerConfig.provisionedConcurrency || 0}</Label>
                  <Slider
                    value={[pendingChanges.agentWorkerConfig?.provisionedConcurrency as number || config?.agentWorkerConfig.provisionedConcurrency || 0]}
                    min={0}
                    max={50}
                    step={1}
                    onValueChange={([v]) => updatePendingChange('agentWorkerConfig.provisionedConcurrency', v)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Pre-warmed instances for instant cold starts (adds cost)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Memory (MB): {config?.agentWorkerConfig.memoryMb || 2048}</Label>
                  <Select
                    value={String(pendingChanges.agentWorkerConfig?.memoryMb || config?.agentWorkerConfig.memoryMb || 2048)}
                    onValueChange={(v) => updatePendingChange('agentWorkerConfig.memoryMb', parseInt(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="512">512 MB</SelectItem>
                      <SelectItem value="1024">1024 MB</SelectItem>
                      <SelectItem value="2048">2048 MB</SelectItem>
                      <SelectItem value="3072">3072 MB</SelectItem>
                      <SelectItem value="4096">4096 MB</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Tenant Isolation */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="w-5 h-5 mr-2" />
                  Tenant Isolation
                </CardTitle>
                <CardDescription>
                  Configure rate limiting and isolation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Isolation Mode</Label>
                  <Select
                    value={pendingChanges.tenantIsolationConfig?.mode as string || config?.tenantIsolationConfig.mode || 'shared'}
                    onValueChange={(v) => updatePendingChange('tenantIsolationConfig.mode', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="shared">Shared Queue</SelectItem>
                      <SelectItem value="dedicated">Dedicated Queues</SelectItem>
                      <SelectItem value="fifo">FIFO (Ordered)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Max Concurrent Per Tenant: {config?.tenantIsolationConfig.maxConcurrentPerTenant || 50}</Label>
                  <Slider
                    value={[pendingChanges.tenantIsolationConfig?.maxConcurrentPerTenant as number || config?.tenantIsolationConfig.maxConcurrentPerTenant || 50]}
                    min={1}
                    max={100}
                    step={5}
                    onValueChange={([v]) => updatePendingChange('tenantIsolationConfig.maxConcurrentPerTenant', v)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Max Concurrent Per User: {config?.tenantIsolationConfig.maxConcurrentPerUser || 10}</Label>
                  <Slider
                    value={[pendingChanges.tenantIsolationConfig?.maxConcurrentPerUser as number || config?.tenantIsolationConfig.maxConcurrentPerUser || 10]}
                    min={1}
                    max={25}
                    step={1}
                    onValueChange={([v]) => updatePendingChange('tenantIsolationConfig.maxConcurrentPerUser', v)}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    checked={pendingChanges.tenantIsolationConfig?.rateLimitingEnabled as boolean ?? config?.tenantIsolationConfig.rateLimitingEnabled ?? true}
                    onCheckedChange={(v) => updatePendingChange('tenantIsolationConfig.rateLimitingEnabled', v)}
                  />
                  <Label>Enable Rate Limiting</Label>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Caching Tab */}
        <TabsContent value="caching" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Database className="w-5 h-5 mr-2" />
                Cache Configuration
              </CardTitle>
              <CardDescription>
                Redis/ElastiCache settings for agent and execution state
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-semibold">Cache Statistics</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Backend</span>
                      <Badge>{dashboard?.agentCacheMetrics.backend || 'memory'}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Hit Rate</span>
                      <span>{((dashboard?.agentCacheMetrics.hitRate || 0) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Hits</span>
                      <span>{dashboard?.agentCacheMetrics.hitCount || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Misses</span>
                      <span>{dashboard?.agentCacheMetrics.missCount || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Evictions</span>
                      <span>{dashboard?.agentCacheMetrics.evictionCount || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Memory Used</span>
                      <span>{((dashboard?.agentCacheMetrics.memoryUsageBytes || 0) / 1024 / 1024).toFixed(2)} MB</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Avg Latency</span>
                      <span>{dashboard?.agentCacheMetrics.avgLatencyMs.toFixed(2)}ms</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold">Cache Actions</h4>
                  <div className="space-y-2">
                    <Button variant="outline" className="w-full" onClick={async () => {
                      await fetch('/api/admin/sovereign-mesh/performance/cache', { method: 'DELETE' });
                      fetchData();
                    }}>
                      Clear Tenant Cache
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Clears cached agent definitions and execution state for this tenant
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Bell className="w-5 h-5 mr-2" />
                Alert Configuration
              </CardTitle>
              <CardDescription>
                Configure performance alert thresholds
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={pendingChanges.alertConfig?.dlqAlertEnabled as boolean ?? config?.alertConfig.dlqAlertEnabled ?? true}
                      onCheckedChange={(v) => updatePendingChange('alertConfig.dlqAlertEnabled', v)}
                    />
                    <Label>DLQ Alert Enabled</Label>
                  </div>
                  <div className="space-y-2">
                    <Label>DLQ Threshold: {config?.alertConfig.dlqAlertThreshold || 10} messages</Label>
                    <Slider
                      value={[pendingChanges.alertConfig?.dlqAlertThreshold as number || config?.alertConfig.dlqAlertThreshold || 10]}
                      min={1}
                      max={100}
                      step={1}
                      onValueChange={([v]) => updatePendingChange('alertConfig.dlqAlertThreshold', v)}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={pendingChanges.alertConfig?.latencyAlertEnabled as boolean ?? config?.alertConfig.latencyAlertEnabled ?? true}
                      onCheckedChange={(v) => updatePendingChange('alertConfig.latencyAlertEnabled', v)}
                    />
                    <Label>Latency Alert Enabled</Label>
                  </div>
                  <div className="space-y-2">
                    <Label>Latency Threshold: {(config?.alertConfig.latencyAlertThresholdMs || 30000) / 1000}s</Label>
                    <Slider
                      value={[(pendingChanges.alertConfig?.latencyAlertThresholdMs as number || config?.alertConfig.latencyAlertThresholdMs || 30000) / 1000]}
                      min={5}
                      max={120}
                      step={5}
                      onValueChange={([v]) => updatePendingChange('alertConfig.latencyAlertThresholdMs', v * 1000)}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recommendations Tab */}
        <TabsContent value="recommendations" className="space-y-4">
          {recommendations.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <CheckCircle2 className="w-12 h-12 mx-auto text-green-500 mb-4" />
                <h3 className="text-lg font-semibold">All Optimized!</h3>
                <p className="text-muted-foreground">
                  No performance recommendations at this time
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {recommendations.map(rec => (
                <Card key={rec.id}>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={rec.priority === 'high' ? 'destructive' : rec.priority === 'medium' ? 'default' : 'secondary'}>
                            {rec.priority}
                          </Badge>
                          <Badge variant="outline">{rec.category}</Badge>
                          <h4 className="font-semibold">{rec.title}</h4>
                        </div>
                        <p className="text-sm text-muted-foreground">{rec.description}</p>
                        <div className="flex gap-4 text-sm">
                          <span>Current: <code className="bg-muted px-1 rounded">{rec.currentValue}</code></span>
                          <span>Recommended: <code className="bg-muted px-1 rounded">{rec.recommendedValue}</code></span>
                        </div>
                        <p className="text-sm text-green-600">{rec.estimatedImpact}</p>
                      </div>
                      {rec.autoApplyAvailable && (
                        <Button onClick={() => applyRecommendation(rec.id)}>
                          Apply
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
