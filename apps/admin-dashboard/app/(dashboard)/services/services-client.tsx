'use client';

import { useState } from 'react';
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
import { ServiceState, SERVICE_STATE_COLORS } from '@/lib/api/types';

interface MidLevelService {
  id: string;
  name: string;
  displayName: string;
  description: string;
  state: ServiceState;
  requiredModels: string[];
  availableModels: string[];
  unavailableModels: string[];
  minTier: number;
  pricePerRequest: number;
  icon: React.ElementType;
}

const mockServices: MidLevelService[] = [
  {
    id: 'perception-service',
    name: 'perception',
    displayName: 'Perception Service',
    description: 'Computer vision pipeline combining classification, detection, and segmentation',
    state: 'RUNNING',
    requiredModels: ['resnet-152', 'yolov8-x'],
    availableModels: ['resnet-152', 'yolov8-x', 'sam-2'],
    unavailableModels: [],
    minTier: 2,
    pricePerRequest: 0.05,
    icon: Eye,
  },
  {
    id: 'scientific-service',
    name: 'scientific',
    displayName: 'Scientific Computing',
    description: 'Protein folding, embeddings, and mathematical reasoning',
    state: 'DEGRADED',
    requiredModels: ['esm-fold', 'esm-2'],
    availableModels: ['esm-2'],
    unavailableModels: ['esm-fold'],
    minTier: 3,
    pricePerRequest: 0.15,
    icon: Brain,
  },
  {
    id: 'medical-service',
    name: 'medical',
    displayName: 'Medical Imaging',
    description: 'Medical image analysis and segmentation pipelines',
    state: 'RUNNING',
    requiredModels: ['medsam', 'medclip'],
    availableModels: ['medsam', 'medclip'],
    unavailableModels: [],
    minTier: 4,
    pricePerRequest: 0.25,
    icon: Microscope,
  },
  {
    id: 'geospatial-service',
    name: 'geospatial',
    displayName: 'Geospatial Analysis',
    description: 'Satellite imagery analysis and geographic feature detection',
    state: 'OFFLINE',
    requiredModels: ['satmae', 'geoclip'],
    availableModels: [],
    unavailableModels: ['satmae', 'geoclip'],
    minTier: 4,
    pricePerRequest: 0.20,
    icon: Globe2,
  },
  {
    id: 'reconstruction-service',
    name: 'reconstruction',
    displayName: '3D Reconstruction',
    description: 'Generate 3D models from images using NeRF and Point-E',
    state: 'RUNNING',
    requiredModels: ['point-e', 'shap-e'],
    availableModels: ['point-e', 'shap-e'],
    unavailableModels: [],
    minTier: 3,
    pricePerRequest: 0.30,
    icon: Box,
  },
];

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
  const [services] = useState(mockServices);

  const runningCount = services.filter(s => s.state === 'RUNNING').length;
  const degradedCount = services.filter(s => s.state === 'DEGRADED').length;
  const offlineCount = services.filter(s => s.state === 'OFFLINE' || s.state === 'DISABLED').length;

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
        {services.map((service) => {
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
                      <p className="font-medium">${service.pricePerRequest.toFixed(2)}</p>
                      <p className="text-muted-foreground">per request</p>
                    </div>
                    <Badge variant="outline">Tier {service.minTier}+</Badge>
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
                    <p className="text-sm font-medium mb-2">Required Models</p>
                    <div className="flex flex-wrap gap-2">
                      {service.requiredModels.map((model) => (
                        <Badge 
                          key={model} 
                          variant={service.availableModels.includes(model) ? 'default' : 'destructive'}
                        >
                          {service.availableModels.includes(model) ? (
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                          ) : (
                            <AlertCircle className="h-3 w-3 mr-1" />
                          )}
                          {model}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">Model Status</p>
                    <div className="flex gap-4 text-sm">
                      <span className="text-green-600">
                        {service.availableModels.length} available
                      </span>
                      {service.unavailableModels.length > 0 && (
                        <span className="text-red-600">
                          {service.unavailableModels.length} unavailable
                        </span>
                      )}
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
