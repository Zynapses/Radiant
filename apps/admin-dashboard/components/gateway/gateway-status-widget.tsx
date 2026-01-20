'use client';

import { useQuery } from '@tanstack/react-query';
import { Activity, AlertTriangle, CheckCircle, Wifi, WifiOff, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface GatewayStatus {
  status: 'healthy' | 'degraded' | 'down';
  connections: number;
  messagesPerMinute: number;
  latencyMs: number;
  errorRate: number;
  activeInstances: number;
  alerts: number;
}

async function fetchGatewayStatus(): Promise<GatewayStatus> {
  try {
    const res = await fetch('/api/admin/gateway/dashboard');
    const data = await res.json();
    
    if (!data.success) {
      return {
        status: 'down',
        connections: 0,
        messagesPerMinute: 0,
        latencyMs: 0,
        errorRate: 0,
        activeInstances: 0,
        alerts: 0,
      };
    }

    const { overview, alerts } = data.data;
    
    // Determine status based on metrics
    let status: 'healthy' | 'degraded' | 'down' = 'healthy';
    if (overview.activeInstances === 0) {
      status = 'down';
    } else if (overview.errorRate > 5 || overview.avgLatencyMs > 500 || alerts.length > 0) {
      status = 'degraded';
    }

    return {
      status,
      connections: overview.totalConnections,
      messagesPerMinute: overview.messagesPerMinute,
      latencyMs: overview.avgLatencyMs,
      errorRate: overview.errorRate,
      activeInstances: overview.activeInstances,
      alerts: alerts.length,
    };
  } catch {
    return {
      status: 'down',
      connections: 0,
      messagesPerMinute: 0,
      latencyMs: 0,
      errorRate: 0,
      activeInstances: 0,
      alerts: 0,
    };
  }
}

interface GatewayStatusWidgetProps {
  className?: string;
  compact?: boolean;
}

export function GatewayStatusWidget({ className, compact = false }: GatewayStatusWidgetProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['gateway-status'],
    queryFn: fetchGatewayStatus,
    refetchInterval: 30000,
  });

  const statusConfig = {
    healthy: {
      label: 'Healthy',
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      borderColor: 'border-green-200',
    },
    degraded: {
      label: 'Degraded',
      icon: AlertTriangle,
      color: 'text-amber-600',
      bgColor: 'bg-amber-100',
      borderColor: 'border-amber-200',
    },
    down: {
      label: 'Down',
      icon: WifiOff,
      color: 'text-red-600',
      bgColor: 'bg-red-100',
      borderColor: 'border-red-200',
    },
  };

  if (isLoading) {
    return (
      <Card className={cn('animate-pulse', className)}>
        <CardContent className="p-4">
          <div className="h-16 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  const status = data?.status || 'down';
  const config = statusConfig[status];
  const StatusIcon = config.icon;

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2 p-2 rounded-lg border', config.borderColor, config.bgColor, className)}>
        <StatusIcon className={cn('h-4 w-4', config.color)} />
        <span className={cn('text-sm font-medium', config.color)}>Gateway: {config.label}</span>
        {data && data.connections > 0 && (
          <Badge variant="secondary" className="ml-auto">
            {data.connections.toLocaleString()} conn
          </Badge>
        )}
      </div>
    );
  }

  return (
    <Card className={cn('border', config.borderColor, className)}>
      <CardHeader className={cn('pb-2', config.bgColor)}>
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <Wifi className="h-4 w-4" />
            Multi-Protocol Gateway
          </span>
          <Badge className={cn(config.bgColor, config.color, 'border', config.borderColor)}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {config.label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        {data && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Connections</p>
              <p className="text-lg font-semibold">{data.connections.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Messages/min</p>
              <p className="text-lg font-semibold">{data.messagesPerMinute.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Latency</p>
              <p className={cn('text-lg font-semibold', data.latencyMs > 100 ? 'text-amber-600' : '')}>
                {data.latencyMs}ms
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Instances</p>
              <p className="text-lg font-semibold">{data.activeInstances}</p>
            </div>
            {data.alerts > 0 && (
              <div className="col-span-2 flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">{data.alerts} active alert{data.alerts !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default GatewayStatusWidget;
