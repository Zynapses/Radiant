'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Layers, 
  Eye, 
  Brain, 
  Microscope, 
  Globe2, 
  Box,
  RefreshCw,
  Settings,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { ServiceState, MidLevelService as ApiMidLevelService } from '@/lib/api/types';
import { servicesApi } from '@/lib/api/endpoints';

interface ServiceDisplayData extends ApiMidLevelService {
  icon: React.ElementType;
}

const SERVICE_ICONS: Record<string, React.ElementType> = {
  perception: Eye,
  scientific: Brain,
  medical: Microscope,
  geospatial: Globe2,
  reconstruction: Box,
};

function getStateLabel(state: ServiceState): string {
  return state.charAt(0) + state.slice(1).toLowerCase();
}

function getStateIcon(state: ServiceState) {
  switch (state) {
    case 'RUNNING':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'DEGRADED':
      return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    case 'DISABLED':
    case 'OFFLINE':
      return <AlertCircle className="h-4 w-4 text-red-500" />;
  }
}

export function ServicesClient() {
  const { data: servicesData = [], isLoading, refetch } = useQuery<ServiceDisplayData[]>({
    queryKey: ['services'],
    queryFn: async () => {
      const apiServices = await servicesApi.list();
      return apiServices.map(s => ({
        ...s,
        icon: SERVICE_ICONS[s.name] || Layers,
      }));
    },
  });

  const services = servicesData;
  const runningCount = services.filter((s: ServiceDisplayData) => s.state === 'RUNNING').length;
  const degradedCount = services.filter((s: ServiceDisplayData) => s.state === 'DEGRADED').length;
  const offlineCount = services.filter((s: ServiceDisplayData) => s.state === 'OFFLINE' || s.state === 'DISABLED').length;

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mid-Level Services</h1>
          <p className="text-muted-foreground">
            Manage orchestrated AI service pipelines
          </p>
        </div>
        <Button variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh Status
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Services</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{services.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Running</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{runningCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Degraded</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{degradedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Offline</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{offlineCount}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6">
        {services.map((service: ServiceDisplayData) => {
          const Icon = service.icon;
          return (
            <Card key={service.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {service.displayName}
                        <Badge variant={service.state === 'RUNNING' ? 'default' : service.state === 'DEGRADED' ? 'secondary' : 'destructive'}>
                          {getStateIcon(service.state)}
                          <span className="ml-1">{getStateLabel(service.state)}</span>
                        </Badge>
                      </CardTitle>
                      <CardDescription>{service.description}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right text-sm">
                      <p className="font-medium">{service.metrics.requestsLast24h.toLocaleString()}</p>
                      <p className="text-muted-foreground">requests/24h</p>
                    </div>
                    <Badge variant={service.healthStatus === 'healthy' ? 'default' : 'secondary'}>
                      {service.healthStatus}
                    </Badge>
                    <Switch checked={service.state !== 'DISABLED'} />
                    <Button variant="ghost" size="icon">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium mb-2">Models</p>
                    <div className="flex flex-wrap gap-2">
                      {service.models.map((model: string) => (
                        <Badge key={model} variant="outline">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          {model}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">Performance</p>
                    <div className="flex gap-4 text-sm">
                      <span className="text-muted-foreground">
                        Latency: {service.metrics.avgLatencyMs}ms
                      </span>
                      <span className={service.metrics.errorRate < 1 ? 'text-green-600' : 'text-red-600'}>
                        Error rate: {service.metrics.errorRate.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
