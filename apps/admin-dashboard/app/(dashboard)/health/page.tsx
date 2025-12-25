'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

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

export default function HealthPage() {
  const queryClient = useQueryClient();

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

      {/* Service Grid */}
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
              <Card key={service.name}>
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
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

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
    </div>
  );
}
