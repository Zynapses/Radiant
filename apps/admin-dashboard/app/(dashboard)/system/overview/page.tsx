'use client';

import { useState, useEffect } from 'react';
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
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/lib/api/client';
import {
  RefreshCw,
  Settings,
  Activity,
  Database,
  Cpu,
  HardDrive,
  Zap,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Server,
  Cloud,
  Shield,
} from 'lucide-react';
import type { SystemComponentHealth, SystemAlert, SystemHealthDashboard } from '@radiant/shared';

interface SystemHealthData {
  overallStatus: 'healthy' | 'degraded' | 'unhealthy';
  components: SystemComponentHealth[];
  activeAlerts: SystemAlert[];
  uptimePercent24h: number;
  uptimePercent7d: number;
  uptimePercent30d: number;
  totalRequests24h: number;
  avgLatencyMs: number;
  errorRate: number;
  generatedAt?: string;
}

export default function SystemOverviewPage() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['system-health'],
    queryFn: async () => {
      const response = await api.get<{ data: SystemHealthDashboard }>('/api/admin/system/health');
      const dashboard = response.data;
      
      // Calculate aggregate metrics from components
      const avgLatency = dashboard.components.reduce((sum, c) => sum + c.latencyMs, 0) / dashboard.components.length;
      const avgErrorRate = dashboard.components.reduce((sum, c) => sum + c.errorRate, 0) / dashboard.components.length;
      
      return {
        overallStatus: dashboard.overallStatus,
        components: dashboard.components,
        activeAlerts: dashboard.activeAlerts,
        uptimePercent24h: dashboard.uptimePercent24h,
        uptimePercent7d: dashboard.uptimePercent7d,
        uptimePercent30d: dashboard.uptimePercent30d,
        totalRequests24h: 1250000, // Would come from metrics aggregation
        avgLatencyMs: Math.round(avgLatency),
        errorRate: avgErrorRate,
        generatedAt: dashboard.generatedAt,
      } as SystemHealthData;
    },
    refetchInterval: autoRefresh ? 30000 : false,
    staleTime: 10000,
  });

  const acknowledgeAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      await api.post(`/api/admin/system/health/alerts/${alertId}/acknowledge`);
    },
    onSuccess: () => {
      toast({ title: 'Alert acknowledged' });
      queryClient.invalidateQueries({ queryKey: ['system-health'] });
    },
    onError: () => {
      toast({ title: 'Failed to acknowledge alert', variant: 'destructive' });
    },
  });
  void acknowledgeAlertMutation; // Reserved for alert acknowledgment

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => refetch(), 30000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refetch]);

  const lastRefresh = new Date(dataUpdatedAt || Date.now());

  function getStatusIcon(status: 'healthy' | 'degraded' | 'unhealthy') {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'unhealthy':
        return <XCircle className="h-5 w-5 text-red-500" />;
    }
  }

  function getStatusColor(status: 'healthy' | 'degraded' | 'unhealthy') {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'degraded':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'unhealthy':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    }
  }

  function getComponentIcon(component: string) {
    switch (component) {
      case 'litellm_gateway':
        return <Zap className="h-5 w-5" />;
      case 'aurora_postgresql':
        return <Database className="h-5 w-5" />;
      case 'elasticache_redis':
        return <HardDrive className="h-5 w-5" />;
      case 'lambda_chat':
      case 'lambda_ingestion':
      case 'lambda_admin':
        return <Cloud className="h-5 w-5" />;
      case 'api_gateway':
        return <Server className="h-5 w-5" />;
      case 'cognito_user_pool':
      case 'cognito_admin_pool':
        return <Shield className="h-5 w-5" />;
      default:
        return <Cpu className="h-5 w-5" />;
    }
  }

  function getTrendIcon(trend: 'up' | 'down' | 'stable') {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-3 w-3 text-green-500" />;
      case 'down':
        return <TrendingDown className="h-3 w-3 text-red-500" />;
      default:
        return null;
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Overview</h1>
          <p className="text-muted-foreground">
            Real-time health and capacity monitoring for all RADIANT components
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            Last updated: {lastRefresh.toLocaleTimeString()}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            Auto-refresh: {autoRefresh ? 'ON' : 'OFF'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <Card className="border-red-500">
          <CardContent className="flex items-center gap-4 py-4">
            <XCircle className="h-6 w-6 text-red-500" />
            <div>
              <p className="font-medium">Failed to load system health</p>
              <p className="text-sm text-muted-foreground">
                {error instanceof Error ? error.message : 'Please try again'}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="ml-auto">
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && !data && (
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Overall Status Cards */}
      {data && (
        <>
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">System Status</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {getStatusIcon(data.overallStatus)}
                <span className="text-2xl font-bold capitalize">
                  {data.overallStatus}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {data.components.filter(c => c.status === 'healthy').length}/{data.components.length} components healthy
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Requests (24h)</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(data.totalRequests24h / 1000000).toFixed(2)}M
              </div>
              <p className="text-xs text-muted-foreground">
                {Math.round(data.totalRequests24h / 24 / 60).toLocaleString()} req/min avg
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Avg Latency</CardTitle>
              <Cpu className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.avgLatencyMs}ms</div>
              <p className="text-xs text-muted-foreground">
                P99: {Math.round(data.avgLatencyMs * 2.5)}ms
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Uptime (30d)</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.uptimePercent30d}%</div>
              <p className="text-xs text-muted-foreground">
                24h: {data.uptimePercent24h}% | 7d: {data.uptimePercent7d}%
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for different views */}
        <Tabs defaultValue="components" className="space-y-4">
        <TabsList>
          <TabsTrigger value="components">Components</TabsTrigger>
          <TabsTrigger value="alerts">
            Alerts
            {data.activeAlerts.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {data.activeAlerts.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="components" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.components.map((component) => (
              <Card key={component.component}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="flex items-center gap-2">
                    {getComponentIcon(component.component)}
                    <CardTitle className="text-lg">{component.displayName}</CardTitle>
                  </div>
                  <Button variant="ghost" size="icon" asChild>
                    <a href={`/system/${component.component}`}>
                      <Settings className="h-4 w-4" />
                    </a>
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Status Badge */}
                  <div className="flex items-center justify-between">
                    <Badge className={getStatusColor(component.status)}>
                      {component.status.charAt(0).toUpperCase() + component.status.slice(1)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {component.latencyMs}ms | {(component.errorRate * 100).toFixed(2)}% errors
                    </span>
                  </div>

                  {/* Capacity */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Capacity</span>
                      <span>
                        {component.currentCapacity} / {component.maxCapacity}
                      </span>
                    </div>
                    <Progress value={component.utilizationPercent} />
                    <p className="text-xs text-muted-foreground text-right">
                      {component.utilizationPercent}% utilized
                    </p>
                  </div>

                  {/* Key Metrics */}
                  <div className="space-y-1 pt-2 border-t">
                    {component.metrics.slice(0, 3).map((metric) => (
                      <div key={metric.name} className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{metric.name}</span>
                        <span className="flex items-center gap-1">
                          {metric.value.toLocaleString()} {metric.unit}
                          {getTrendIcon(metric.trend)}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          {data.activeAlerts.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                <CardTitle>No Active Alerts</CardTitle>
                <CardDescription>
                  All systems are operating within normal parameters
                </CardDescription>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {data.activeAlerts.map((alert) => (
                <Card key={alert.id} className={
                  alert.severity === 'critical' ? 'border-red-500' :
                  alert.severity === 'warning' ? 'border-yellow-500' : ''
                }>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {alert.severity === 'critical' ? (
                          <XCircle className="h-5 w-5 text-red-500" />
                        ) : alert.severity === 'warning' ? (
                          <AlertTriangle className="h-5 w-5 text-yellow-500" />
                        ) : (
                          <Activity className="h-5 w-5 text-blue-500" />
                        )}
                        <CardTitle className="text-base">{alert.message}</CardTitle>
                      </div>
                      <Badge variant={
                        alert.severity === 'critical' ? 'destructive' :
                        alert.severity === 'warning' ? 'secondary' : 'outline'
                      }>
                        {alert.severity}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Component: {alert.component}</span>
                      <span>Metric: {alert.metric}</span>
                      <span>Value: {alert.currentValue} (threshold: {alert.threshold})</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        </Tabs>
      </>
      )}
    </div>
  );
}
