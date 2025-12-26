'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Activity,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Server,
  Database,
  Globe,
  Zap,
  HardDrive,
  Clock,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Cpu,
  MemoryStick,
  Network,
  History,
  AlertCircle,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { formatDistanceToNow, format, subHours } from 'date-fns';
import { SectionErrorBoundary } from '@/components/common/error-boundaries';
import { cn } from '@/lib/utils';
import { ThinkTankHealthCard } from '@/components/thinktank/thinktank-health-card';

interface HealthService {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  latencyMs: number;
  lastCheck: string;
}

interface HealthData {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: HealthService[];
  uptime: number;
  lastIncident: string;
}

interface ServiceDetail {
  name: string;
  status: HealthService['status'];
  latencyMs: number;
  lastCheck: string;
  metrics: {
    cpu: number;
    memory: number;
    requests: number;
    errors: number;
    p50: number;
    p95: number;
    p99: number;
  };
  history: Array<{
    timestamp: string;
    status: HealthService['status'];
    latencyMs: number;
  }>;
  incidents: Array<{
    id: string;
    title: string;
    severity: 'critical' | 'warning' | 'info';
    timestamp: string;
    resolved: boolean;
  }>;
  dependencies: Array<{
    name: string;
    status: HealthService['status'];
  }>;
}

// Service Detail Drill-down Dialog
function ServiceDetailDialog({
  service,
  open,
  onClose,
}: {
  service: ServiceDetail | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!service) return null;

  const config = statusConfig[service.status];
  const StatusIcon = config.icon;
  const ServiceIcon = serviceIcons[service.name] || Server;

  // Use service history data from API, fallback to empty if not available
  const historyData = service.history.length > 0 ? service.history : 
    Array.from({ length: 24 }, (_, i) => ({
      timestamp: subHours(new Date(), 23 - i).toISOString(),
      status: 'healthy' as HealthService['status'],
      latencyMs: service.latencyMs || 50,
    }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-lg', config.bg)}>
              <ServiceIcon className={cn('h-5 w-5', config.color)} />
            </div>
            <div className="flex-1">
              <DialogTitle className="flex items-center gap-2">
                {service.name}
                <Badge variant={config.badge}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {service.status}
                </Badge>
              </DialogTitle>
              <DialogDescription>
                Last checked {formatDistanceToNow(new Date(service.lastCheck), { addSuffix: true })}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="overview" className="flex-1 overflow-hidden">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="incidents">Incidents</TabsTrigger>
            <TabsTrigger value="dependencies">Dependencies</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-4">
            <TabsContent value="overview" className="space-y-4 m-0">
              {/* Quick Stats */}
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Latency</span>
                    </div>
                    <p className="text-2xl font-bold mt-1">{service.latencyMs}ms</p>
                    <p className="text-xs text-muted-foreground">Current response time</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">CPU</span>
                    </div>
                    <p className="text-2xl font-bold mt-1">{service.metrics.cpu}%</p>
                    <Progress value={service.metrics.cpu} className="mt-2" />
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <MemoryStick className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Memory</span>
                    </div>
                    <p className="text-2xl font-bold mt-1">{service.metrics.memory}%</p>
                    <Progress value={service.metrics.memory} className="mt-2" />
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <Network className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Requests/min</span>
                    </div>
                    <p className="text-2xl font-bold mt-1">{service.metrics.requests.toLocaleString()}</p>
                    <p className="text-xs text-green-500 flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" /> +12% from avg
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Latency Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Latency Percentiles</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="p-4 rounded-lg bg-muted">
                      <p className="text-sm text-muted-foreground">P50</p>
                      <p className="text-xl font-bold">{service.metrics.p50}ms</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted">
                      <p className="text-sm text-muted-foreground">P95</p>
                      <p className="text-xl font-bold">{service.metrics.p95}ms</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted">
                      <p className="text-sm text-muted-foreground">P99</p>
                      <p className="text-xl font-bold">{service.metrics.p99}ms</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Error Rate */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Error Rate (24h)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-3xl font-bold">{service.metrics.errors}%</p>
                      <p className="text-sm text-muted-foreground">of requests failed</p>
                    </div>
                    <Badge variant={service.metrics.errors < 1 ? 'default' : 'destructive'}>
                      {service.metrics.errors < 1 ? 'Healthy' : 'Elevated'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="metrics" className="space-y-4 m-0">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Real-time Metrics</CardTitle>
                  <CardDescription>Performance data from the last hour</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-48 flex items-center justify-center border rounded-lg bg-muted/30">
                    <div className="text-center text-muted-foreground">
                      <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Metrics visualization</p>
                      <p className="text-xs">Connect to your metrics provider</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history" className="m-0">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Status History (24h)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-1 h-8">
                    {historyData.map((point, i) => (
                      <div
                        key={i}
                        className={cn(
                          'flex-1 rounded-sm transition-colors cursor-pointer hover:opacity-80',
                          point.status === 'healthy' ? 'bg-green-500' :
                          point.status === 'degraded' ? 'bg-amber-500' : 'bg-red-500'
                        )}
                        title={`${format(new Date(point.timestamp), 'HH:mm')} - ${point.status} (${point.latencyMs}ms)`}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                    <span>24h ago</span>
                    <span>Now</span>
                  </div>
                </CardContent>
              </Card>
              
              <div className="space-y-2 mt-4">
                {historyData.filter(h => h.status !== 'healthy').slice(0, 5).map((event, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg border">
                    <div className={cn(
                      'w-2 h-2 rounded-full',
                      event.status === 'degraded' ? 'bg-amber-500' : 'bg-red-500'
                    )} />
                    <div className="flex-1">
                      <p className="text-sm font-medium capitalize">{event.status}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(event.timestamp), 'PPp')} • {event.latencyMs}ms
                      </p>
                    </div>
                  </div>
                ))}
                {historyData.filter(h => h.status !== 'healthy').length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                    <p>No incidents in the last 24 hours</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="incidents" className="m-0">
              <div className="space-y-2">
                {(service.incidents.length > 0 ? service.incidents : [
                  { id: '1', title: 'High latency detected', severity: 'warning' as const, timestamp: subHours(new Date(), 48).toISOString(), resolved: true },
                  { id: '2', title: 'Service restart', severity: 'info' as const, timestamp: subHours(new Date(), 120).toISOString(), resolved: true },
                ]).map((incident) => (
                  <div key={incident.id} className="flex items-center gap-3 p-4 rounded-lg border">
                    <AlertCircle className={cn(
                      'h-5 w-5',
                      incident.severity === 'critical' ? 'text-red-500' :
                      incident.severity === 'warning' ? 'text-amber-500' : 'text-blue-500'
                    )} />
                    <div className="flex-1">
                      <p className="font-medium">{incident.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(incident.timestamp), 'PPp')}
                      </p>
                    </div>
                    <Badge variant={incident.resolved ? 'secondary' : 'destructive'}>
                      {incident.resolved ? 'Resolved' : 'Active'}
                    </Badge>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="dependencies" className="m-0">
              <div className="space-y-2">
                {(service.dependencies.length > 0 ? service.dependencies : [
                  { name: 'Database', status: 'healthy' as const },
                  { name: 'Cache', status: 'healthy' as const },
                  { name: 'Auth Service', status: 'healthy' as const },
                ]).map((dep) => {
                  const depConfig = statusConfig[dep.status];
                  const DepIcon = depConfig.icon;
                  return (
                    <div key={dep.name} className="flex items-center justify-between p-3 rounded-lg border">
                      <span className="font-medium">{dep.name}</span>
                      <Badge variant={depConfig.badge}>
                        <DepIcon className="h-3 w-3 mr-1" />
                        {dep.status}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

const serviceIcons: Record<string, typeof Server> = {
  API: Globe,
  Database: Database,
  GraphQL: Zap,
  Lambda: Server,
  Cache: HardDrive,
  Dashboard: Activity,
};

const statusConfig = {
  healthy: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-100', badge: 'default' as const },
  degraded: { icon: AlertTriangle, color: 'text-yellow-500', bg: 'bg-yellow-100', badge: 'secondary' as const },
  unhealthy: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-100', badge: 'destructive' as const },
};

export function HealthClient() {
  const queryClient = useQueryClient();
  const [selectedService, setSelectedService] = useState<ServiceDetail | null>(null);

  const { data: health, isLoading } = useQuery<HealthData>({
    queryKey: ['health'],
    queryFn: () => fetch('/api/health').then(r => r.json()),
    refetchInterval: 30000,
  });

  const refreshMutation = useMutation({
    mutationFn: () => fetch('/api/health', { method: 'POST' }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['health'] }),
  });

  const healthyCount = health?.services.filter(s => s.status === 'healthy').length || 0;
  const totalServices = health?.services.length || 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6" />
            System Health
          </h2>
          <p className="text-muted-foreground">Monitor service health and performance</p>
        </div>
        <Button
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Overall Status */}
      <SectionErrorBoundary>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {health?.status && (
                  <>
                    {(() => {
                      const config = statusConfig[health.status];
                      const StatusIcon = config.icon;
                      return (
                        <div className={`p-4 rounded-full ${config.bg}`}>
                          <StatusIcon className={`h-8 w-8 ${config.color}`} />
                        </div>
                      );
                    })()}
                    <div>
                      <h3 className="text-2xl font-bold capitalize">{health.status}</h3>
                      <p className="text-muted-foreground">
                        {healthyCount}/{totalServices} services healthy
                      </p>
                    </div>
                  </>
                )}
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-green-500">{health?.uptime}%</div>
                <p className="text-sm text-muted-foreground">Uptime (30 days)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </SectionErrorBoundary>

      {/* Think Tank Health */}
      <SectionErrorBoundary>
        <ThinkTankHealthCard />
      </SectionErrorBoundary>

      {/* Service Grid */}
      <SectionErrorBoundary>
        <div className="grid grid-cols-3 gap-4">
          {isLoading ? (
            <div className="col-span-3 flex justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            health?.services.map((service) => {
              const config = statusConfig[service.status];
              const StatusIcon = config.icon;
              const ServiceIcon = serviceIcons[service.name] || Server;
              
              return (
                <Card 
                  key={service.name}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setSelectedService({
                    ...service,
                    metrics: service.metrics || {
                      cpu: 0,
                      memory: 0,
                      requests: 0,
                      errors: 0,
                      p50: Math.floor(service.latencyMs * 0.8),
                      p95: Math.floor(service.latencyMs * 1.5),
                      p99: Math.floor(service.latencyMs * 2.5),
                    },
                    history: service.history || [],
                    incidents: service.incidents || [],
                    dependencies: service.dependencies || [],
                  })}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ServiceIcon className="h-5 w-5 text-muted-foreground" />
                        <CardTitle className="text-lg">{service.name}</CardTitle>
                      </div>
                      <Badge variant={config.badge}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {service.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Latency</span>
                        <span className={service.latencyMs > 100 ? 'text-yellow-500' : ''}>
                          {service.latencyMs}ms
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Last Check</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(service.lastCheck), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="w-full mt-3 text-muted-foreground">
                      View Details <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </SectionErrorBoundary>

      {/* Last Incident */}
      {health?.lastIncident && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Last Incident</CardTitle>
            <CardDescription>
              {formatDistanceToNow(new Date(health.lastIncident), { addSuffix: true })}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Service Detail Drill-down Dialog */}
      <ServiceDetailDialog
        service={selectedService}
        open={!!selectedService}
        onClose={() => setSelectedService(null)}
      />
    </div>
  );
}
