'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Globe, 
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Settings,
  Key,
  Activity
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { apiClient } from '@/lib/api';

interface Provider {
  id: string;
  name: string;
  displayName: string;
  type: string;
  status: string;
  healthStatus: string;
  modelsCount: number;
  latencyMs: number;
  uptime: number;
  isEnabled: boolean;
  hasCredentials: boolean;
}

export default function ProvidersPage() {
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [showCredentialsDialog, setShowCredentialsDialog] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const queryClient = useQueryClient();

  const { data: providers, isLoading } = useQuery({
    queryKey: ['providers'],
    queryFn: async (): Promise<Provider[]> => {
      return apiClient.get<Provider[]>('/admin/providers');
    },
  });

  const toggleProviderMutation = useMutation({
    mutationFn: async ({ id, isEnabled }: { id: string; isEnabled: boolean }) => {
      await apiClient.put(`/admin/providers/${id}`, { isEnabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] });
    },
  });

  const updateCredentialsMutation = useMutation({
    mutationFn: async ({ id, apiKey }: { id: string; apiKey: string }) => {
      await apiClient.put(`/admin/providers/${id}/credentials`, { apiKey });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] });
      setShowCredentialsDialog(false);
      setApiKey('');
    },
  });

  const getHealthBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Badge className="bg-green-500"><CheckCircle className="mr-1 h-3 w-3" />Healthy</Badge>;
      case 'degraded':
        return <Badge className="bg-yellow-500"><AlertTriangle className="mr-1 h-3 w-3" />Degraded</Badge>;
      case 'unhealthy':
        return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />Unhealthy</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'external':
        return <Badge variant="secondary">External</Badge>;
      case 'self-hosted':
        return <Badge className="bg-purple-500">Self-Hosted</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const healthyProviders = providers?.filter(p => p.healthStatus === 'healthy').length ?? 0;
  const totalModels = providers?.reduce((sum, p) => sum + p.modelsCount, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Providers</h1>
          <p className="text-muted-foreground">
            Manage AI providers and their credentials
          </p>
        </div>
        <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ['providers'] })}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Providers</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{providers?.length ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Healthy</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{healthyProviders}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Models</CardTitle>
            <Activity className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalModels}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Latency</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {providers?.length ? Math.round(providers.reduce((sum, p) => sum + p.latencyMs, 0) / providers.length) : 0}ms
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {providers?.map((provider) => (
          <Card key={provider.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  {provider.displayName}
                  {getTypeBadge(provider.type)}
                </CardTitle>
                <Switch
                  checked={provider.isEnabled}
                  onCheckedChange={(checked: boolean) => 
                    toggleProviderMutation.mutate({ id: provider.id, isEnabled: checked })
                  }
                />
              </div>
              <CardDescription>{provider.name}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Health</span>
                {getHealthBadge(provider.healthStatus)}
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Uptime</span>
                  <span>{(provider.uptime * 100).toFixed(1)}%</span>
                </div>
                <Progress value={provider.uptime * 100} />
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Models</p>
                  <p className="font-medium">{provider.modelsCount}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Latency</p>
                  <p className="font-medium">{provider.latencyMs}ms</p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setSelectedProvider(provider);
                    setShowCredentialsDialog(true);
                  }}
                >
                  <Key className="mr-2 h-4 w-4" />
                  {provider.hasCredentials ? 'Update Key' : 'Add Key'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showCredentialsDialog} onOpenChange={setShowCredentialsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update API Credentials</DialogTitle>
            <DialogDescription>
              {selectedProvider?.displayName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>API Key</Label>
              <Input
                type="password"
                value={apiKey}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setApiKey(e.target.value)}
                placeholder="Enter API key..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCredentialsDialog(false)}>Cancel</Button>
            <Button
              onClick={() => selectedProvider && updateCredentialsMutation.mutate({ id: selectedProvider.id, apiKey })}
              disabled={!apiKey || updateCredentialsMutation.isPending}
            >
              Save Credentials
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
