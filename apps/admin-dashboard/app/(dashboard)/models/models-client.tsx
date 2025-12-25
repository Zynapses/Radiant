'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Cpu, 
  Search, 
  RefreshCw,
  Zap,
  DollarSign,
  Activity,
  Settings,
  Power,
  PowerOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { apiClient } from '@/lib/api';

interface Model {
  id: string;
  name: string;
  displayName: string;
  provider: string;
  category: string;
  status: string;
  inputCostPer1k: number;
  outputCostPer1k: number;
  maxTokens: number;
  contextWindow: number;
  isEnabled: boolean;
}

export function ModelsClient() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const queryClient = useQueryClient();

  const { data: models, isLoading } = useQuery({
    queryKey: ['models'],
    queryFn: async (): Promise<Model[]> => {
      return apiClient.get<Model[]>('/admin/models');
    },
  });

  const toggleModelMutation = useMutation({
    mutationFn: async ({ id, isEnabled }: { id: string; isEnabled: boolean }) => {
      await apiClient.put(`/admin/models/${id}`, { isEnabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['models'] });
    },
  });

  const filteredModels = models?.filter(model =>
    model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    model.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    model.provider.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500">Active</Badge>;
      case 'warming':
        return <Badge className="bg-yellow-500">Warming</Badge>;
      case 'cold':
        return <Badge variant="secondary">Cold</Badge>;
      case 'disabled':
        return <Badge variant="outline">Disabled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getCategoryBadge = (category: string) => {
    const colors: Record<string, string> = {
      'chat': 'bg-blue-500',
      'code': 'bg-purple-500',
      'vision': 'bg-green-500',
      'embedding': 'bg-orange-500',
      'audio': 'bg-pink-500',
    };
    return <Badge className={colors[category] || 'bg-gray-500'}>{category}</Badge>;
  };

  const formatCost = (cost: number) => `$${cost.toFixed(4)}`;

  const activeModels = models?.filter(m => m.status === 'active').length ?? 0;
  const totalModels = models?.length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Models</h1>
          <p className="text-muted-foreground">
            Manage AI models and their configurations
          </p>
        </div>
        <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ['models'] })}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Models</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalModels}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <Activity className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeModels}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Providers</CardTitle>
            <Zap className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(models?.map(m => m.provider)).size}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(models?.map(m => m.category)).size}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Models</CardTitle>
              <CardDescription>Configure model availability and pricing</CardDescription>
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search models..."
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                className="pl-8 w-64"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Input Cost</TableHead>
                <TableHead>Output Cost</TableHead>
                <TableHead>Context</TableHead>
                <TableHead className="text-right">Enabled</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredModels?.map((model) => (
                <TableRow key={model.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{model.displayName}</p>
                      <p className="text-xs text-muted-foreground font-mono">{model.name}</p>
                    </div>
                  </TableCell>
                  <TableCell>{model.provider}</TableCell>
                  <TableCell>{getCategoryBadge(model.category)}</TableCell>
                  <TableCell>{getStatusBadge(model.status)}</TableCell>
                  <TableCell>{formatCost(model.inputCostPer1k)}/1k</TableCell>
                  <TableCell>{formatCost(model.outputCostPer1k)}/1k</TableCell>
                  <TableCell>{(model.contextWindow / 1000).toFixed(0)}k</TableCell>
                  <TableCell className="text-right">
                    <Switch
                      checked={model.isEnabled}
                      onCheckedChange={(checked: boolean) => 
                        toggleModelMutation.mutate({ id: model.id, isEnabled: checked })
                      }
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
