'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { 
  Layers, 
  Search,
  Plus,
  RefreshCw,
  Cpu,
  Settings,
  Play,
  Pause,
  Download,
  Upload,
} from 'lucide-react';

interface LoRAAdapter {
  id: string;
  name: string;
  base_model: string;
  layer: 'base' | 'domain' | 'tenant';
  rank: number;
  alpha: number;
  target_modules: string[];
  status: 'active' | 'training' | 'inactive' | 'failed';
  created_at: string;
  last_used: string;
  usage_count: number;
  performance_score: number;
  size_mb: number;
  tenant_id?: string;
  tenant_name?: string;
}

interface LoRAConfig {
  max_adapters_per_model: number;
  default_rank: number;
  default_alpha: number;
  auto_merge_threshold: number;
  garbage_collection_days: number;
  enable_hot_swapping: boolean;
  enable_adapter_stacking: boolean;
}

async function fetchAdapters(): Promise<LoRAAdapter[]> {
  const res = await fetch('/api/admin/lora/adapters');
  if (!res.ok) throw new Error('Failed to fetch adapters');
  const data = await res.json();
  return data.adapters || [];
}

async function fetchConfig(): Promise<LoRAConfig> {
  const res = await fetch('/api/admin/lora/config');
  if (!res.ok) throw new Error('Failed to fetch config');
  return res.json();
}

export default function LoRAPage() {
  const _queryClient = useQueryClient();
  void _queryClient; // Reserved for mutations
  const [searchQuery, setSearchQuery] = useState('');
  const [layerFilter, setLayerFilter] = useState<string>('all');

  const { data: adapters = [], isLoading: adaptersLoading } = useQuery({
    queryKey: ['lora-adapters'],
    queryFn: fetchAdapters,
  });

  const { data: config } = useQuery({
    queryKey: ['lora-config'],
    queryFn: fetchConfig,
  });

  const filteredAdapters = adapters.filter(adapter => {
    const matchesSearch = adapter.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      adapter.base_model.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLayer = layerFilter === 'all' || adapter.layer === layerFilter;
    return matchesSearch && matchesLayer;
  });

  const baseAdapters = adapters.filter(a => a.layer === 'base');
  const domainAdapters = adapters.filter(a => a.layer === 'domain');
  const tenantAdapters = adapters.filter(a => a.layer === 'tenant');
  const _activeCount = adapters.filter(a => a.status === 'active').length;
  void _activeCount; // Reserved for statistics display

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge className="bg-green-500">Active</Badge>;
      case 'training': return <Badge className="bg-blue-500">Training</Badge>;
      case 'failed': return <Badge variant="destructive">Failed</Badge>;
      default: return <Badge variant="secondary">Inactive</Badge>;
    }
  };

  const getLayerBadge = (layer: string) => {
    switch (layer) {
      case 'base': return <Badge className="bg-purple-500">Base</Badge>;
      case 'domain': return <Badge className="bg-blue-500">Domain</Badge>;
      case 'tenant': return <Badge className="bg-green-500">Tenant</Badge>;
      default: return <Badge variant="outline">{layer}</Badge>;
    }
  };

  if (adaptersLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Layers className="h-8 w-8" />
            LoRA Adapters
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage tri-layer LoRA adapter system for model customization
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Adapter
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Adapters</CardDescription>
            <CardTitle className="text-3xl">{adapters.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Base Layer</CardDescription>
            <CardTitle className="text-3xl text-purple-500">{baseAdapters.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Domain Layer</CardDescription>
            <CardTitle className="text-3xl text-blue-500">{domainAdapters.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Tenant Layer</CardDescription>
            <CardTitle className="text-3xl text-green-500">{tenantAdapters.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="adapters" className="space-y-4">
        <TabsList>
          <TabsTrigger value="adapters">Adapters</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="training">Training Queue</TabsTrigger>
        </TabsList>

        <TabsContent value="adapters" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>LoRA Adapters</CardTitle>
                  <CardDescription>Manage all adapter layers</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search adapters..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 w-64"
                    />
                  </div>
                  <div className="flex gap-1">
                    {['all', 'base', 'domain', 'tenant'].map((layer) => (
                      <Button
                        key={layer}
                        variant={layerFilter === layer ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setLayerFilter(layer)}
                        className="capitalize"
                      >
                        {layer}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Adapter</TableHead>
                    <TableHead>Base Model</TableHead>
                    <TableHead>Layer</TableHead>
                    <TableHead>Rank/Alpha</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Performance</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAdapters.map((adapter) => (
                    <TableRow key={adapter.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{adapter.name}</div>
                          {adapter.tenant_name && (
                            <div className="text-sm text-muted-foreground">{adapter.tenant_name}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{adapter.base_model}</TableCell>
                      <TableCell>{getLayerBadge(adapter.layer)}</TableCell>
                      <TableCell>
                        <span className="font-mono text-sm">r{adapter.rank}/α{adapter.alpha}</span>
                      </TableCell>
                      <TableCell>{getStatusBadge(adapter.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={adapter.performance_score * 100} className="w-16 h-2" />
                          <span className="text-sm">{(adapter.performance_score * 100).toFixed(0)}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {adapter.size_mb.toFixed(1)} MB
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {adapter.usage_count.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" title="Download">
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Settings">
                            <Settings className="h-4 w-4" />
                          </Button>
                          {adapter.status === 'active' ? (
                            <Button variant="ghost" size="icon" title="Deactivate">
                              <Pause className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button variant="ghost" size="icon" title="Activate">
                              <Play className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Adapter Settings
                </CardTitle>
                <CardDescription>
                  Configure default adapter parameters
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Default Rank</Label>
                    <Input type="number" defaultValue={config?.default_rank || 8} />
                  </div>
                  <div className="space-y-2">
                    <Label>Default Alpha</Label>
                    <Input type="number" defaultValue={config?.default_alpha || 16} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Max Adapters per Model</Label>
                  <Input type="number" defaultValue={config?.max_adapters_per_model || 10} />
                </div>
                <div className="space-y-2">
                  <Label>Auto-Merge Threshold</Label>
                  <Input type="number" step="0.01" defaultValue={config?.auto_merge_threshold || 0.9} />
                  <p className="text-xs text-muted-foreground">
                    Similarity threshold for automatic adapter merging
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Garbage Collection (days)</Label>
                  <Input type="number" defaultValue={config?.garbage_collection_days || 30} />
                  <p className="text-xs text-muted-foreground">
                    Remove unused adapters after this many days
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="h-5 w-5" />
                  Runtime Features
                </CardTitle>
                <CardDescription>
                  Enable/disable runtime adapter features
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Hot Swapping</Label>
                    <p className="text-sm text-muted-foreground">
                      Switch adapters without model reload
                    </p>
                  </div>
                  <Switch defaultChecked={config?.enable_hot_swapping} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Adapter Stacking</Label>
                    <p className="text-sm text-muted-foreground">
                      Combine multiple adapters at inference
                    </p>
                  </div>
                  <Switch defaultChecked={config?.enable_adapter_stacking} />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="training" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Training Queue</CardTitle>
              <CardDescription>
                Monitor adapter training jobs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Cpu className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No active training jobs</p>
                <Button variant="outline" className="mt-4">
                  <Upload className="h-4 w-4 mr-2" />
                  Start Training
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
