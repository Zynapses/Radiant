'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, AlertCircle, XCircle, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HealthItem {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency?: number;
}

const healthData: HealthItem[] = [
  { name: 'API Gateway', status: 'healthy', latency: 45 },
  { name: 'Aurora PostgreSQL', status: 'healthy', latency: 12 },
  { name: 'LiteLLM Proxy', status: 'healthy', latency: 89 },
  { name: 'DynamoDB', status: 'healthy', latency: 8 },
];

const statusConfig = {
  healthy: {
    icon: CheckCircle,
    color: 'text-green-500',
    bg: 'bg-green-100 dark:bg-green-900/30',
  },
  degraded: {
    icon: AlertCircle,
    color: 'text-yellow-500',
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
  },
  unhealthy: {
    icon: XCircle,
    color: 'text-red-500',
    bg: 'bg-red-100 dark:bg-red-900/30',
  },
};

export function SystemHealth() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          System Health
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {healthData.map((item) => {
            const config = statusConfig[item.status];
            const Icon = config.icon;

            return (
              <div
                key={item.name}
                className={cn(
                  'flex items-center justify-between p-3 rounded-lg',
                  config.bg
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon className={cn('h-5 w-5', config.color)} />
                  <span className="font-medium">{item.name}</span>
                </div>
                {item.latency && (
                  <span className="text-sm text-muted-foreground">
                    {item.latency}ms
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
